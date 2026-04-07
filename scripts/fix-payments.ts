// scripts/fix-payments.ts
// Run with: npx tsx scripts/fix-payments.ts
//
// Fixes payments to match Airtable exactly, then re-imports at_cash_7_7 values.

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
async function fetchAllAirtableRecords(
  extraFields: string[] = []
): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}`
    );
    url.searchParams.set("pageSize", "100");
    for (const f of extraFields) {
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

// ─── Mappers ────────────────────────────────────────
function mapEstado(raw: unknown): string | null {
  const s = String(raw || "")
    .toLowerCase()
    .trim();
  if (s === "pagado") return "pagado";
  if (s === "pendiente") return "pendiente";
  if (s === "perdido") return "perdido";
  if (s === "refund") return "refund";
  return null;
}

function mapMetodoPago(raw: unknown): string | null {
  const s = String(raw || "").trim();
  const map: Record<string, string> = {
    Binance: "binance",
    TRANSFERENCIA: "transferencia",
    "CAJA DE AHORRO USD": "caja_ahorro_usd",
    "Link MP": "link_mp",
    Cash: "cash",
    Uruguayos: "uruguayos",
    "Link Stripe": "link_stripe",
  };
  return map[s] || null;
}

function mapReceptor(raw: unknown): string | null {
  // Airtable multiselect comes as an array of strings
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.join(", ");
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return null;
}

// ─── Main ───────────────────────────────────────────
async function main() {
  console.log("=== Fix Payments from Airtable ===\n");

  // 1. Fetch all Airtable records with payment fields
  console.log("Fetching Airtable records...");
  const records = await fetchAllAirtableRecords([
    "💰 Pago 1",
    "💰 Pago 2",
    "💰 Pago 3",
    "📊 Estado 1",
    "📊 Estado 2",
    "📊 Estado 3",
    "📆 Fecha de Pago 1",
    "📆 Fecha de Pago 2",
    "📆 Fecha de Pago 3",
    "Metodo de pago ",
    "Recibe",
    "💰 PESOS",
    "🏆 Cash Collected del 7 al 7",
    "🏆 Cash Collected del 7 al 7 Cuotas",
  ]);
  console.log(`Total Airtable records: ${records.length}\n`);

  // 2. Get existing leads from Supabase
  const { data: existingLeads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, airtable_id");

  if (leadsErr) throw new Error(`Failed to fetch leads: ${leadsErr.message}`);

  const leadMap = new Map<string, string>(); // airtable_id -> supabase uuid
  for (const l of existingLeads ?? []) {
    if (l.airtable_id) leadMap.set(l.airtable_id, l.id);
  }

  console.log(`Leads in Supabase: ${leadMap.size}\n`);

  // 3. Process payments
  let updated = 0;
  let created = 0;
  let deleted = 0;
  let skipped = 0;
  let errors = 0;

  for (const rec of records) {
    const f = rec.fields;
    const leadId = leadMap.get(rec.id);

    if (!leadId) {
      skipped++;
      continue;
    }

    const metodoPago = mapMetodoPago(f["Metodo de pago "]);
    const receptor = mapReceptor(f["Recibe"]);

    for (let i = 1; i <= 3; i++) {
      const monto = Number(f[`💰 Pago ${i}`] || 0);
      const estadoRaw = f[`📊 Estado ${i}`];
      const fecha = f[`📆 Fecha de Pago ${i}`] as string | undefined;
      const estado = mapEstado(estadoRaw);

      // Find existing payment in Supabase
      const { data: existingPay } = await supabase
        .from("payments")
        .select("id")
        .eq("lead_id", leadId)
        .eq("numero_cuota", i)
        .eq("es_renovacion", false)
        .limit(1)
        .single();

      if (monto > 0) {
        // Upsert this payment
        const payData: Record<string, unknown> = {
          monto_usd: monto,
          fecha_pago: fecha || null,
        };
        if (estado) payData.estado = estado;
        if (metodoPago) payData.metodo_pago = metodoPago;
        if (receptor) payData.receptor = receptor;

        if (existingPay) {
          const { error } = await supabase
            .from("payments")
            .update(payData)
            .eq("id", existingPay.id);

          if (error) {
            console.error(
              `  Error updating payment ${existingPay.id}: ${error.message}`
            );
            errors++;
          } else {
            updated++;
          }
        } else {
          const { error } = await supabase.from("payments").insert({
            lead_id: leadId,
            numero_cuota: i,
            monto_usd: monto,
            estado: estado || "pendiente",
            fecha_pago: fecha || null,
            metodo_pago: metodoPago,
            receptor: receptor,
            es_renovacion: false,
          });

          if (error) {
            console.error(
              `  Error creating payment for ${rec.id} cuota ${i}: ${error.message}`
            );
            errors++;
          } else {
            created++;
          }
        }
      } else if (existingPay && monto === 0) {
        // Payment exists in Supabase but monto=0 in Airtable → delete
        const { error } = await supabase
          .from("payments")
          .delete()
          .eq("id", existingPay.id);

        if (error) {
          console.error(
            `  Error deleting payment ${existingPay.id}: ${error.message}`
          );
          errors++;
        } else {
          deleted++;
        }
      }
    }

    // Progress log
    const total = updated + created + deleted + skipped;
    if (total % 100 === 0) {
      console.log(`  Processed ${total} operations...`);
    }
  }

  console.log("\n=== PAYMENTS SUMMARY ===");
  console.log(`Updated:  ${updated}`);
  console.log(`Created:  ${created}`);
  console.log(`Deleted:  ${deleted}`);
  console.log(`Skipped (no lead):  ${skipped}`);
  console.log(`Errors:   ${errors}`);

  // ─── Part 2: Re-import at_cash_7_7 values ────────
  console.log("\n=== Re-importing at_cash_7_7 values ===\n");

  let totalCashUpdated = 0;
  let sumCash77 = 0;
  let sumCuotas77 = 0;

  for (const rec of records) {
    const f = rec.fields;
    const cash77 = Number(f["🏆 Cash Collected del 7 al 7"] || 0);
    const cashCuotas77 = Number(
      f["🏆 Cash Collected del 7 al 7 Cuotas"] || 0
    );
    const total = cash77 + cashCuotas77;

    if (cash77 !== 0 || cashCuotas77 !== 0) {
      const { error } = await supabase
        .from("leads")
        .update({
          at_cash_7_7: cash77,
          at_cash_cuotas_7_7: cashCuotas77,
          at_cash_total: total,
        })
        .eq("airtable_id", rec.id);

      if (error) {
        console.error(`  Error updating cash for ${rec.id}: ${error.message}`);
      } else {
        totalCashUpdated++;
        sumCash77 += cash77;
        sumCuotas77 += cashCuotas77;
      }
    }
  }

  console.log("=== CASH 7-7 SUMMARY ===");
  console.log(`Leads updated: ${totalCashUpdated}`);
  console.log(
    `Sum at_cash_7_7:        $${sumCash77.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  );
  console.log(
    `Sum at_cash_cuotas_7_7: $${sumCuotas77.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  );
  console.log(
    `Sum TOTAL:              $${(sumCash77 + sumCuotas77).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
