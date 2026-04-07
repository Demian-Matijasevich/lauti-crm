// scripts/fix-cuotas-pendientes.ts
// Run with: npx tsx scripts/fix-cuotas-pendientes.ts
//
// 1. Re-creates pending cuotas that were deleted (monto=0 in Airtable but have Estado=Pendiente)
// 2. Sets fecha_vencimiento on ALL payments (was never migrated from Airtable)

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TABLE_ID = "tbleCytRILP3D7Q3N"; // Reporte de Llamadas

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// ─── Airtable Fetch ─────────────────────────────────
async function fetchAllAirtableRecords(): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  const fields = [
    "💰 Pago 1",
    "💰 Pago 2",
    "💰 Pago 3",
    "📊 Estado 1",
    "📊 Estado 2",
    "📊 Estado 3",
    "📆 Fecha de Pago 1",
    "📆 Fecha de Pago 2",
    "📆 Fecha de Pago 3",
    "💰 Ticket Total",
    "🧾 Plan de Pago (Venta)",
    "📆 Semaforo Próxima Cuota 2",
    "📆 Fecha Próxima Cuota",
    "👤 Nombre del Lead",
  ];

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}`
    );
    url.searchParams.set("pageSize", "100");
    for (const f of fields) {
      url.searchParams.append("fields[]", f);
    }
    if (offset) url.searchParams.set("offset", offset);

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

    console.log(`  Fetched ${allRecords.length} records so far...`);
  } while (offset);

  return allRecords;
}

// ─── Helpers ───────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getNumCuotas(planPago: string): number {
  const lower = planPago.toLowerCase().trim();
  if (lower.includes("3 cuotas") || lower.includes("3cuotas")) return 3;
  if (lower.includes("2 cuotas") || lower.includes("2cuotas")) return 2;
  if (lower.includes("personalizado")) return 3; // assume max
  return 1;
}

function normalizeEstado(raw: unknown): string | null {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "pagado") return "pagado";
  if (s === "pendiente") return "pendiente";
  if (s === "perdido") return "perdido";
  if (s === "refund") return "refund";
  return null;
}

// ─── Main ──────────────────────────────────────────
async function main() {
  console.log("=== Fix Cuotas Pendientes & Fecha Vencimiento ===\n");

  // 1. Fetch Airtable
  console.log("Fetching Airtable records...");
  const records = await fetchAllAirtableRecords();
  console.log(`Total Airtable records: ${records.length}\n`);

  // 2. Get lead map (airtable_id -> supabase id)
  const { data: existingLeads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, airtable_id");

  if (leadsErr) throw new Error(`Failed to fetch leads: ${leadsErr.message}`);

  const leadMap = new Map<string, string>();
  for (const l of existingLeads ?? []) {
    if (l.airtable_id) leadMap.set(l.airtable_id, l.id);
  }
  console.log(`Leads in Supabase: ${leadMap.size}\n`);

  let createdPendientes = 0;
  let updatedVencimientos = 0;
  let skipped = 0;
  let errors = 0;

  for (const rec of records) {
    const f = rec.fields;
    const leadId = leadMap.get(rec.id);
    if (!leadId) {
      skipped++;
      continue;
    }

    const nombre = f["👤 Nombre del Lead"] as string || rec.id;
    const planPago = (f["🧾 Plan de Pago (Venta)"] as string) || "";
    const ticketTotal = Number(f["💰 Ticket Total"] || 0);
    const numCuotas = getNumCuotas(planPago);

    const pagos = [
      {
        cuota: 1,
        monto: Number(f["💰 Pago 1"] || 0),
        estado: normalizeEstado(f["📊 Estado 1"]),
        fecha: (f["📆 Fecha de Pago 1"] as string) || null,
      },
      {
        cuota: 2,
        monto: Number(f["💰 Pago 2"] || 0),
        estado: normalizeEstado(f["📊 Estado 2"]),
        fecha: (f["📆 Fecha de Pago 2"] as string) || null,
      },
      {
        cuota: 3,
        monto: Number(f["💰 Pago 3"] || 0),
        estado: normalizeEstado(f["📊 Estado 3"]),
        fecha: (f["📆 Fecha de Pago 3"] as string) || null,
      },
    ];

    // Get cuota 1 fecha for vencimiento calculations
    const cuota1Fecha = pagos[0].fecha;

    // Fecha próxima cuota from Airtable (useful fallback)
    const fechaProximaCuota = (f["📆 Fecha Próxima Cuota"] as string) || null;

    for (const pago of pagos) {
      // Skip cuotas beyond the plan
      if (pago.cuota > numCuotas) continue;

      // Calculate fecha_vencimiento
      let fechaVencimiento: string | null = null;
      if (pago.cuota === 1) {
        // Cuota 1: vencimiento = same as fecha_pago
        fechaVencimiento = pago.fecha;
      } else if (pago.cuota === 2) {
        if (pago.fecha) {
          fechaVencimiento = pago.fecha; // Use actual date if available
        } else if (cuota1Fecha) {
          fechaVencimiento = addDays(cuota1Fecha, 30);
        } else if (fechaProximaCuota) {
          fechaVencimiento = fechaProximaCuota;
        }
      } else if (pago.cuota === 3) {
        if (pago.fecha) {
          fechaVencimiento = pago.fecha;
        } else if (cuota1Fecha) {
          fechaVencimiento = addDays(cuota1Fecha, 60);
        }
      }

      // Check if payment exists in Supabase
      const { data: existingPay } = await supabase
        .from("payments")
        .select("id, estado, fecha_vencimiento")
        .eq("lead_id", leadId)
        .eq("numero_cuota", pago.cuota)
        .eq("es_renovacion", false)
        .limit(1)
        .single();

      if (existingPay) {
        // Payment exists → update fecha_vencimiento if missing
        const updates: Record<string, unknown> = {};
        if (!existingPay.fecha_vencimiento && fechaVencimiento) {
          updates.fecha_vencimiento = fechaVencimiento;
        }
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from("payments")
            .update(updates)
            .eq("id", existingPay.id);
          if (error) {
            console.error(`  Error updating vencimiento for ${nombre} cuota ${pago.cuota}: ${error.message}`);
            errors++;
          } else {
            updatedVencimientos++;
          }
        }
      } else if (pago.estado === "pendiente") {
        // Payment doesn't exist and estado=pendiente → create it
        const estimatedMonto = ticketTotal > 0 && numCuotas > 0
          ? Math.round(ticketTotal / numCuotas)
          : 0;

        const { error } = await supabase.from("payments").insert({
          lead_id: leadId,
          numero_cuota: pago.cuota,
          monto_usd: pago.monto > 0 ? pago.monto : estimatedMonto,
          estado: "pendiente",
          fecha_pago: null,
          fecha_vencimiento: fechaVencimiento,
          es_renovacion: false,
        });

        if (error) {
          console.error(`  Error creating pendiente for ${nombre} cuota ${pago.cuota}: ${error.message}`);
          errors++;
        } else {
          createdPendientes++;
          console.log(`  + Created pendiente: ${nombre} cuota ${pago.cuota} (venc: ${fechaVencimiento ?? "N/A"}, monto: $${pago.monto > 0 ? pago.monto : estimatedMonto})`);
        }
      }
    }

    // Progress
    const total = createdPendientes + updatedVencimientos + skipped;
    if (total % 50 === 0 && total > 0) {
      console.log(`  Progress: ${total} operations...`);
    }
  }

  // Part 2: Also set fecha_vencimiento on existing payments that lack it,
  // using the cuota 1 fecha_pago as reference
  console.log("\n--- Setting vencimiento on remaining payments without it ---");

  const { data: leadsWithPayments, error: lpErr } = await supabase
    .from("payments")
    .select("id, lead_id, numero_cuota, fecha_pago, fecha_vencimiento, es_renovacion")
    .is("fecha_vencimiento", null)
    .eq("es_renovacion", false)
    .order("lead_id")
    .order("numero_cuota");

  if (lpErr) {
    console.error(`Error fetching payments without vencimiento: ${lpErr.message}`);
  } else {
    // Group by lead_id
    const byLead = new Map<string, typeof leadsWithPayments>();
    for (const p of leadsWithPayments ?? []) {
      const arr = byLead.get(p.lead_id) || [];
      arr.push(p);
      byLead.set(p.lead_id, arr);
    }

    let extraUpdated = 0;
    for (const [leadId, payments] of byLead) {
      // Find cuota 1 fecha_pago for this lead
      const { data: cuota1 } = await supabase
        .from("payments")
        .select("fecha_pago")
        .eq("lead_id", leadId)
        .eq("numero_cuota", 1)
        .eq("es_renovacion", false)
        .limit(1)
        .single();

      const baseFecha = cuota1?.fecha_pago;
      if (!baseFecha) continue;

      for (const p of payments) {
        let venc: string | null = null;
        if (p.numero_cuota === 1) {
          venc = baseFecha;
        } else if (p.numero_cuota === 2) {
          venc = addDays(baseFecha, 30);
        } else if (p.numero_cuota === 3) {
          venc = addDays(baseFecha, 60);
        }

        if (venc) {
          const { error } = await supabase
            .from("payments")
            .update({ fecha_vencimiento: venc })
            .eq("id", p.id);
          if (!error) extraUpdated++;
        }
      }
    }

    console.log(`Extra vencimientos set: ${extraUpdated}`);
    updatedVencimientos += extraUpdated;
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Pendientes created:     ${createdPendientes}`);
  console.log(`Vencimientos updated:   ${updatedVencimientos}`);
  console.log(`Skipped (no lead):      ${skipped}`);
  console.log(`Errors:                 ${errors}`);

  // Final count of pendiente payments
  const { count } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("estado", "pendiente");

  const { count: countWithVenc } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .not("fecha_vencimiento", "is", null);

  const { count: totalPayments } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true });

  console.log(`\nTotal payments in DB:        ${totalPayments}`);
  console.log(`Total pendientes in DB:      ${count}`);
  console.log(`Payments with vencimiento:   ${countWithVenc}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
