// app/api/sync/route.ts
// Full Airtable → Supabase sync endpoint (runs nightly via n8n cron)
// Combines: sync-airtable.ts + import-airtable-7-7.ts + sync-commissions.ts + health-score refresh

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
async function syncLeadsAndPayments(supabase: ReturnType<typeof createServerClient>) {
  const records = await fetchAllRecords(REPORTE_TABLE_ID);

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
      const { error } = await supabase
        .from("leads")
        .update({
          at_cash_7_7,
          at_cash_cuotas_7_7,
          at_cash_total: at_cash_7_7 + at_cash_cuotas_7_7,
          ticket_total,
        })
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

  return { synced, newLeads, updatedPayments, createdPayments, errors };
}

// ─── Step 2: Sync commissions ──────────────────────
async function syncCommissions(supabase: ReturnType<typeof createServerClient>) {
  // Fetch setter lookup
  const setterRecords = await fetchAllRecords(SETTER_TABLE_ID, ["🙎‍♂️ Nombre Completo"]);
  const setterIdToName = new Map<string, string>();
  for (const rec of setterRecords) {
    const name = rec.fields["🙎‍♂️ Nombre Completo"] as string | undefined;
    if (name) setterIdToName.set(rec.id, name);
  }

  // Fetch reporte with commission fields
  const reporteRecords = await fetchAllRecords(REPORTE_TABLE_ID, [
    "setter del 7 al 7",
    "closer del 7 al 7",
    "👤 Closer",
    "🙎‍♂️ Setter",
  ]);

  const closerCommissions = new Map<string, number>();
  const setterCommissions = new Map<string, number>();

  for (const rec of reporteRecords) {
    const f = rec.fields;

    const closerAmount = Number(f["closer del 7 al 7"] || 0);
    if (closerAmount > 0) {
      const closerField = f["👤 Closer"] as { name?: string } | undefined;
      const closerName = closerField?.name;
      if (closerName) {
        closerCommissions.set(closerName, (closerCommissions.get(closerName) || 0) + closerAmount);
      }
    }

    const setterAmount = Number(f["setter del 7 al 7"] || 0);
    if (setterAmount > 0) {
      const setterIds = (f["🙎‍♂️ Setter"] as string[] | undefined) || [];
      for (const sid of setterIds) {
        const setterName = setterIdToName.get(sid);
        if (setterName) {
          setterCommissions.set(setterName, (setterCommissions.get(setterName) || 0) + setterAmount);
        }
      }
    }
  }

  // Mel's cobranzas
  const clienteRecords = await fetchAllRecords(CLIENTES_TABLE_ID, ["Cash collected melanie"]);
  let melCashCuotas = 0;
  for (const rec of clienteRecords) {
    melCashCuotas += Number(rec.fields["Cash collected melanie"] || 0);
  }
  const melCobranzas = melCashCuotas * 0.10;

  // Build commission map per UUID
  const commissionMap = new Map<string, { closer: number; setter: number; cobranzas: number }>();
  const ensureEntry = (uuid: string) => {
    if (!commissionMap.has(uuid)) commissionMap.set(uuid, { closer: 0, setter: 0, cobranzas: 0 });
    return commissionMap.get(uuid)!;
  };

  for (const [name, amount] of closerCommissions) {
    const uuid = resolveUUID(name);
    if (uuid) ensureEntry(uuid).closer += amount;
  }
  for (const [name, amount] of setterCommissions) {
    const uuid = resolveUUID(name);
    if (uuid) ensureEntry(uuid).setter += amount;
  }
  ensureEntry("dfab6e35-e6b2-4941-8e64-931da9511f3f").cobranzas = melCobranzas;

  // Reset all
  await supabase
    .from("team_members")
    .update({ at_comision_closer: 0, at_comision_setter: 0, at_comision_cobranzas: 0, at_comision_total: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  // Update each
  let updated = 0;
  for (const [uuid, comm] of commissionMap) {
    const total = comm.closer + comm.setter + comm.cobranzas;
    if (total === 0) continue;
    const { error } = await supabase
      .from("team_members")
      .update({
        at_comision_closer: comm.closer,
        at_comision_setter: comm.setter,
        at_comision_cobranzas: comm.cobranzas,
        at_comision_total: total,
      })
      .eq("id", uuid);
    if (!error) updated++;
  }

  return { commissionMembers: updated, melCobranzas };
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
export async function POST(request: NextRequest) {
  // Auth: require service role key
  const authHeader = request.headers.get("authorization");
  const serviceKey = request.headers.get("x-service-key");
  const token = (authHeader?.replace("Bearer ", "") || serviceKey || "").trim();

  if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const startTime = Date.now();

  try {
    // Step 1: Sync leads + payments
    const leadsResult = await syncLeadsAndPayments(supabase);

    // Step 2: Sync commissions
    const commissionsResult = await syncCommissions(supabase);

    // Step 3: Refresh health scores
    const healthResult = await refreshHealthScores(supabase);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      duration_seconds: duration,
      leads: leadsResult,
      commissions: commissionsResult,
      health: healthResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /api/sync]", err);
    return NextResponse.json(
      { error: message, duration_seconds: ((Date.now() - startTime) / 1000).toFixed(1) },
      { status: 500 }
    );
  }
}
