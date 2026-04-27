// app/api/sync/route.ts
// Full Airtable → Supabase sync endpoint (runs nightly via n8n cron)
// Combines: sync-airtable.ts + import-airtable-7-7.ts + sync-commissions.ts + health-score refresh

export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

const REPORTE_TABLE_ID = "tbleCytRILP3D7Q3N"; // Reporte de Llamadas
const SETTER_TABLE_ID = "tblhr7BbirhvrorZo"; // Setter lookup table
const CLIENTES_TABLE_ID = "tbloD4rZPAyBKoylS"; // Base de Clientes

// ─── Name → UUID mapping (team members) ────────────
const NAME_TO_UUID: Record<string, string> = {
  "ivan carbone": "9ddbc3a1-6a98-435e-baa1-bfeb23172317",
  "joaquín izcurdia": "49f9c067-22f2-4e87-a343-01a768fd9004",
  "joaquin izcurdia": "49f9c067-22f2-4e87-a343-01a768fd9004",
  "jorge palcios": "8f42f8d8-47c3-42fe-9c86-4d75df18c64a",
  "jorge palacios": "8f42f8d8-47c3-42fe-9c86-4d75df18c64a",
  "lautaro cardozo": "3346163c-83a5-4156-ac3a-917197cd31b0",
  "juan martin wohl": "4e32ceda-e0ce-4b56-bf53-da5d59aa384b",
  "juanma": "4e32ceda-e0ce-4b56-bf53-da5d59aa384b",
  "hernan noesta ma s": "2e33778f-052b-4078-bda2-dff6f408b48a",
  "mel": "dfab6e35-e6b2-4941-8e64-931da9511f3f",
  "m c": "dfab6e35-e6b2-4941-8e64-931da9511f3f",
  "juan goupil": "e4937663-2342-4af6-a906-b810795e27cb",
};

function resolveUUID(name: string): string | null {
  return NAME_TO_UUID[name.toLowerCase().trim()] ?? null;
}

// ─── Airtable helpers ──────────────────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchAllRecords(
  tableId: string,
  fields?: string[],
  filterFormula?: string
): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`
    );
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    if (fields) {
      for (const f of fields) {
        url.searchParams.append("fields[]", f);
      }
    }
    if (filterFormula) {
      url.searchParams.set("filterByFormula", filterFormula);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      records: AirtableRecord[];
      offset?: string;
    };
    allRecords.push(...json.records);
    offset = json.offset;
  } while (offset);

  return allRecords;
}

// ─── Estado mapping ────────────────────────────────
function mapEstado(raw: unknown): string {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "pagado") return "pagado";
  if (s === "pendiente") return "pendiente";
  if (s === "perdido") return "perdido";
  if (s === "refund") return "refund";
  return "pendiente";
}

// ─── Step 1: Sync leads + payments from Airtable ──
async function syncLeadsAndPayments(supabase: ReturnType<typeof createServerClient>, opts?: { offset?: number; limit?: number }) {
  const allRecords = await fetchAllRecords(REPORTE_TABLE_ID);
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? allRecords.length;
  const records = allRecords.slice(offset, offset + limit);

  // Setter lookup table → name → UUID
  const setterRecords = await fetchAllRecords(SETTER_TABLE_ID, ["🙎‍♂️ Nombre Completo"]);
  const setterIdToUUID = new Map<string, string>();
  for (const rec of setterRecords) {
    const name = rec.fields["🙎‍♂️ Nombre Completo"] as string | undefined;
    if (name) {
      const uuid = resolveUUID(name);
      if (uuid) setterIdToUUID.set(rec.id, uuid);
    }
  }

  const { data: existingLeads } = await supabase
    .from("leads")
    .select("id, airtable_id");

  const leadMap = new Map<string, string>();
  for (const l of existingLeads ?? []) {
    if (l.airtable_id) leadMap.set(l.airtable_id, l.id);
  }

  let synced = 0;
  let newLeads = 0;
  let updatedPayments = 0;
  let createdPayments = 0;
  let errors = 0;

  for (const rec of records) {
    const f = rec.fields;
    const airtable_id = rec.id;
    const at_cash_7_7 = Number(f["🏆 Cash Collected del 7 al 7"] || 0);
    const at_cash_cuotas_7_7 = Number(f["🏆 Cash Collected del 7 al 7 Cuotas"] || 0);
    const ticket_total = Number(f["💰 Ticket Total"] || 0);

    // Resolve closer (collaborator field) and setter (linked record array)
    const closerField = f["👤 Closer"] as { name?: string; email?: string } | undefined;
    const closerName = closerField?.name || closerField?.email || "";
    const closer_id = closerName ? resolveUUID(closerName) : null;

    const setterRefs = (f["🙎‍♂️ Setter"] as string[] | undefined) || [];
    const setter_id = setterRefs.length > 0 ? (setterIdToUUID.get(setterRefs[0]) || null) : null;

    // Parse payments
    const payments: { numero_cuota: number; monto_usd: number; estado: string; fecha_pago: string | null }[] = [];
    for (let i = 1; i <= 3; i++) {
      const monto = Number(f[`💰 Pago ${i}`] || 0);
      const estado = f[`📊 Estado ${i}`];
      const fecha = f[`📆 Fecha de Pago ${i}`] as string | undefined;
      if (monto > 0 || estado) {
        payments.push({
          numero_cuota: i,
          monto_usd: monto,
          estado: mapEstado(estado),
          fecha_pago: fecha || null,
        });
      }
    }

    const existingId = leadMap.get(airtable_id);

    if (existingId) {
      const updatePatch: Record<string, unknown> = {
        at_cash_7_7,
        at_cash_cuotas_7_7,
        at_cash_total: at_cash_7_7 + at_cash_cuotas_7_7,
        ticket_total,
      };
      if (closer_id) updatePatch.closer_id = closer_id;
      if (setter_id) updatePatch.setter_id = setter_id;
      const { error } = await supabase
        .from("leads")
        .update(updatePatch)
        .eq("id", existingId);

      if (error) { errors++; continue; }

      for (const pay of payments) {
        const { data: existingPay } = await supabase
          .from("payments")
          .select("id")
          .eq("lead_id", existingId)
          .eq("numero_cuota", pay.numero_cuota)
          .eq("es_renovacion", false)
          .limit(1)
          .single();

        if (existingPay) {
          const { error: upErr } = await supabase
            .from("payments")
            .update({ monto_usd: pay.monto_usd, estado: pay.estado, fecha_pago: pay.fecha_pago })
            .eq("id", existingPay.id);
          if (upErr) errors++; else updatedPayments++;
        } else {
          const { error: crErr } = await supabase.from("payments").insert({
            lead_id: existingId,
            numero_cuota: pay.numero_cuota,
            monto_usd: pay.monto_usd,
            estado: pay.estado,
            fecha_pago: pay.fecha_pago,
            es_renovacion: false,
          });
          if (crErr) errors++; else createdPayments++;
        }
      }
      synced++;
    } else {
      const { data: newLead, error: nlErr } = await supabase
        .from("leads")
        .insert({
          airtable_id,
          nombre: `AT-${airtable_id}`,
          at_cash_7_7,
          at_cash_cuotas_7_7,
          at_cash_total: at_cash_7_7 + at_cash_cuotas_7_7,
          ticket_total,
          closer_id,
          setter_id,
        })
        .select("id")
        .single();

      if (nlErr) { errors++; continue; }

      for (const pay of payments) {
        const { error: crErr } = await supabase.from("payments").insert({
          lead_id: newLead.id,
          numero_cuota: pay.numero_cuota,
          monto_usd: pay.monto_usd,
          estado: pay.estado,
          fecha_pago: pay.fecha_pago,
          es_renovacion: false,
        });
        if (crErr) errors++; else createdPayments++;
      }

      leadMap.set(airtable_id, newLead.id);
      newLeads++;
      synced++;
    }
  }

  return { synced, newLeads, updatedPayments, createdPayments, errors, total_records: allRecords.length, offset, limit, processed: records.length };
}

// ─── Step 2: Sync commissions (NEW SCHEME 2026-04-25) ──────────────────────
// Iván: 10% flat (llamada). Jorge: tiered (chat). Joaquín: tiered si setter+closer, 5% fijo si solo setter.
// Mel: cobranzas 10% (sin cambio).
async function syncCommissions(supabase: ReturnType<typeof createServerClient>) {
  // Import commission logic
  const { computeCommissions } = await import("@/lib/commissions");

  // Get current 7-7 fiscal month range
  // Fiscal mes 7-7: del día 7 del mes anterior al día 7 del mes actual
  const today = new Date();
  let startMonth = today.getMonth();
  let startYear = today.getFullYear();
  if (today.getDate() < 7) {
    startMonth -= 1;
    if (startMonth < 0) { startMonth = 11; startYear -= 1; }
  } else {
    // Current month is the start
  }
  const start = new Date(startYear, startMonth, 7);
  const end = new Date(startYear, startMonth + 1, 6, 23, 59, 59);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  // Fetch payments in fiscal range
  const { data: payments } = await supabase
    .from("payments")
    .select("lead_id, monto_usd, fecha_pago, estado")
    .eq("estado", "pagado")
    .gte("fecha_pago", startStr)
    .lte("fecha_pago", endStr)
    .range(0, 9999);

  // Fetch all leads (for closer_id/setter_id resolution)
  const { data: leads } = await supabase
    .from("leads")
    .select("id, closer_id, setter_id")
    .range(0, 9999);

  // Fetch team
  const { data: team } = await supabase
    .from("team_members")
    .select("id, nombre")
    .eq("activo", true);

  const filteredPays = (payments || [])
    .filter((p) => p.lead_id)
    .map((p) => ({ lead_id: p.lead_id as string, monto_usd: Number(p.monto_usd || 0) }));

  const results = computeCommissions({
    payments: filteredPays,
    leads: (leads || []) as Array<{ id: string; closer_id: string | null; setter_id: string | null }>,
    team: (team || []) as Array<{ id: string; nombre: string }>,
  });

  // Mel's cobranzas (10% sobre cash collected by her — sigue igual)
  const clienteRecords = await fetchAllRecords(CLIENTES_TABLE_ID, ["Cash collected melanie"]);
  let melCashCuotas = 0;
  for (const rec of clienteRecords) {
    melCashCuotas += Number(rec.fields["Cash collected melanie"] || 0);
  }
  const melCobranzas = melCashCuotas * 0.10;
  const MEL_UUID = "dfab6e35-e6b2-4941-8e64-931da9511f3f";

  // Check if at_apto_bono column exists
  const { error: bonoCheck } = await supabase.from("team_members").select("at_apto_bono").limit(1);
  const hasBonoCol = !bonoCheck;

  // Reset all
  const resetPatch: Record<string, unknown> = { at_comision_closer: 0, at_comision_setter: 0, at_comision_cobranzas: 0, at_comision_total: 0 };
  if (hasBonoCol) resetPatch.at_apto_bono = false;
  await supabase
    .from("team_members")
    .update(resetPatch)
    .neq("id", "00000000-0000-0000-0000-000000000000");

  // Update each
  let updated = 0;
  for (const r of results) {
    const cobranzas = r.team_member_id === MEL_UUID ? melCobranzas : 0;
    const total = r.comision_closer + r.comision_setter + cobranzas;
    const updatePatch: Record<string, unknown> = {
      at_comision_closer: r.comision_closer,
      at_comision_setter: r.comision_setter,
      at_comision_cobranzas: cobranzas,
      at_comision_total: total,
    };
    if (hasBonoCol) updatePatch.at_apto_bono = r.apto_bono;
    const { error } = await supabase
      .from("team_members")
      .update(updatePatch)
      .eq("id", r.team_member_id);
    if (!error) updated++;
  }

  // Mel sola si no apareció en results
  if (!results.some((r) => r.team_member_id === MEL_UUID) && melCobranzas > 0) {
    await supabase
      .from("team_members")
      .update({ at_comision_cobranzas: melCobranzas, at_comision_total: melCobranzas })
      .eq("id", MEL_UUID);
    updated++;
  }

  return {
    commissionMembers: updated,
    melCobranzas,
    fiscal_month: { from: startStr, to: endStr },
    breakdown: results.map((r) => ({
      nombre: r.nombre,
      tipo: r.closer_type,
      cash: r.cash_collected,
      tier_pct: r.tier_pct_aplicado,
      closer: r.comision_closer,
      setter: r.comision_setter,
      total: r.comision_total,
      apto_bono: r.apto_bono,
    })),
  };
}

// ─── Step 3: Refresh health scores ─────────────────
async function refreshHealthScores(supabase: ReturnType<typeof createServerClient>) {
  const { data: clients } = await supabase
    .from("clients")
    .select("id")
    .eq("estado", "activo");

  if (!clients || clients.length === 0) return { healthUpdated: 0 };

  let updated = 0;
  for (const client of clients) {
    const { data: score } = await supabase.rpc("calculate_health_score", {
      client_uuid: client.id,
    });
    if (score !== null && score !== undefined) {
      await supabase
        .from("clients")
        .update({ health_score: score })
        .eq("id", client.id);
      updated++;
    }
  }

  return { healthUpdated: updated };
}

// ─── POST handler ──────────────────────────────────
const ADMIN_SECRET = process.env.LAUTI_ADMIN_SECRET || "lauti-sync-2026";

export async function POST(request: NextRequest) {
  // Auth: service role key OR admin secret as ?s= query param
  const authHeader = request.headers.get("authorization");
  const serviceKey = request.headers.get("x-service-key");
  const token = (authHeader?.replace("Bearer ", "") || serviceKey || "").trim();
  const sParam = new URL(request.url).searchParams.get("s");

  const ok = token === process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || sParam === ADMIN_SECRET;
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const startTime = Date.now();
  const urlObj = new URL(request.url);
  const step = urlObj.searchParams.get("step");
  const offset = parseInt(urlObj.searchParams.get("offset") || "0");
  const limit = parseInt(urlObj.searchParams.get("limit") || "0") || undefined;

  try {
    const result: Record<string, unknown> = {};

    if (!step || step === "leads" || step === "all") {
      result.leads = await syncLeadsAndPayments(supabase, { offset, limit });
    }
    if (!step || step === "commissions" || step === "all") {
      result.commissions = await syncCommissions(supabase);
    }
    if (!step || step === "health" || step === "all") {
      result.health = await refreshHealthScores(supabase);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    return NextResponse.json({ success: true, duration_seconds: duration, step: step || "all", ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /api/sync]", err);
    return NextResponse.json(
      { error: message, duration_seconds: ((Date.now() - startTime) / 1000).toFixed(1) },
      { status: 500 }
    );
  }
}
