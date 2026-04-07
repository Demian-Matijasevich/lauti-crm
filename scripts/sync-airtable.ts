// scripts/sync-airtable.ts
// Run with: npx tsx scripts/sync-airtable.ts
//
// Lightweight re-sync from Airtable "Reporte de Llamadas" into Supabase.
// Upserts leads (at_cash_7_7, at_cash_cuotas_7_7, ticket_total, estado)
// and upserts payments (match by lead airtable_id + numero_cuota).

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

// ─── Types ──────────────────────────────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

interface ParsedRecord {
  airtable_id: string;
  at_cash_7_7: number;
  at_cash_cuotas_7_7: number;
  estado: string | null;
  ticket_total: number;
  closer_name: string | null;
  setter_ids: string[];
  payments: {
    numero_cuota: number;
    monto_usd: number;
    estado: string;
    fecha_pago: string | null;
  }[];
}

// ─── Airtable Fetch ─────────────────────────────────
async function fetchAllAirtableRecords(): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}`
    );
    url.searchParams.set("pageSize", "100");
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

// ─── Parse records ──────────────────────────────────
function mapEstado(raw: unknown): string {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "pagado") return "pagado";
  if (s === "pendiente") return "pendiente";
  if (s === "perdido") return "perdido";
  if (s === "refund") return "refund";
  return "pendiente";
}

function parseRecord(rec: AirtableRecord): ParsedRecord {
  const f = rec.fields;

  const payments: ParsedRecord["payments"] = [];
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

  // Closer is a collaborator object
  const closerField = f["👤 Closer"] as { name?: string } | undefined;
  const closer_name = closerField?.name || null;

  // Setter is a linked record array
  const setter_ids = (f["🙎‍♂️ Setter"] as string[] | undefined) || [];

  return {
    airtable_id: rec.id,
    at_cash_7_7: Number(f["🏆 Cash Collected del 7 al 7"] || 0),
    at_cash_cuotas_7_7: Number(f["🏆 Cash Collected del 7 al 7 Cuotas"] || 0),
    estado: (f["📌 Estado de la Llamada"] as string) || null,
    ticket_total: Number(f["💰 Ticket Total"] || 0),
    closer_name,
    setter_ids,
    payments,
  };
}

// ─── Main ───────────────────────────────────────────
async function main() {
  console.log("=== Airtable Sync ===\n");

  // 1. Fetch all Airtable records
  console.log("Fetching Airtable records...");
  const records = await fetchAllAirtableRecords();
  console.log(`Total Airtable records: ${records.length}\n`);

  // 2. Get existing leads from Supabase (to know which exist)
  const { data: existingLeads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, airtable_id");

  if (leadsErr) throw new Error(`Failed to fetch leads: ${leadsErr.message}`);

  const leadMap = new Map<string, string>(); // airtable_id -> supabase uuid
  for (const l of existingLeads ?? []) {
    if (l.airtable_id) leadMap.set(l.airtable_id, l.id);
  }

  // 3. Process records
  let synced = 0;
  let newRecords = 0;
  let updatedPayments = 0;
  let createdPayments = 0;
  let errors = 0;

  for (const rec of records) {
    const parsed = parseRecord(rec);
    const existingId = leadMap.get(parsed.airtable_id);

    if (existingId) {
      // Update existing lead
      const { error } = await supabase
        .from("leads")
        .update({
          at_cash_7_7: parsed.at_cash_7_7,
          at_cash_cuotas_7_7: parsed.at_cash_cuotas_7_7,
          at_cash_total: parsed.at_cash_7_7 + parsed.at_cash_cuotas_7_7,
          ticket_total: parsed.ticket_total,
        })
        .eq("id", existingId);

      if (error) {
        console.error(`  Error updating lead ${parsed.airtable_id}: ${error.message}`);
        errors++;
        continue;
      }

      // Upsert payments
      for (const pay of parsed.payments) {
        // Check if payment exists for this lead + cuota number
        const { data: existingPay } = await supabase
          .from("payments")
          .select("id")
          .eq("lead_id", existingId)
          .eq("numero_cuota", pay.numero_cuota)
          .eq("es_renovacion", false)
          .limit(1)
          .single();

        if (existingPay) {
          // Update existing payment
          const { error: upErr } = await supabase
            .from("payments")
            .update({
              monto_usd: pay.monto_usd,
              estado: pay.estado,
              fecha_pago: pay.fecha_pago,
            })
            .eq("id", existingPay.id);

          if (upErr) {
            console.error(`  Error updating payment ${existingPay.id}: ${upErr.message}`);
            errors++;
          } else {
            updatedPayments++;
          }
        } else {
          // Create new payment
          const { error: crErr } = await supabase.from("payments").insert({
            lead_id: existingId,
            numero_cuota: pay.numero_cuota,
            monto_usd: pay.monto_usd,
            estado: pay.estado,
            fecha_pago: pay.fecha_pago,
            es_renovacion: false,
          });

          if (crErr) {
            console.error(`  Error creating payment for ${parsed.airtable_id}: ${crErr.message}`);
            errors++;
          } else {
            createdPayments++;
          }
        }
      }

      synced++;
    } else {
      // NEW lead — create it
      const { data: newLead, error: nlErr } = await supabase
        .from("leads")
        .insert({
          airtable_id: parsed.airtable_id,
          nombre: `AT-${parsed.airtable_id}`, // placeholder name
          at_cash_7_7: parsed.at_cash_7_7,
          at_cash_cuotas_7_7: parsed.at_cash_cuotas_7_7,
          at_cash_total: parsed.at_cash_7_7 + parsed.at_cash_cuotas_7_7,
          ticket_total: parsed.ticket_total,
        })
        .select("id")
        .single();

      if (nlErr) {
        console.error(`  Error creating lead ${parsed.airtable_id}: ${nlErr.message}`);
        errors++;
        continue;
      }

      // Create payments for new lead
      for (const pay of parsed.payments) {
        const { error: crErr } = await supabase.from("payments").insert({
          lead_id: newLead.id,
          numero_cuota: pay.numero_cuota,
          monto_usd: pay.monto_usd,
          estado: pay.estado,
          fecha_pago: pay.fecha_pago,
          es_renovacion: false,
        });

        if (crErr) {
          console.error(`  Error creating payment for new lead ${parsed.airtable_id}: ${crErr.message}`);
          errors++;
        } else {
          createdPayments++;
        }
      }

      leadMap.set(parsed.airtable_id, newLead.id);
      newRecords++;
      synced++;
    }

    // Progress log every 50
    if (synced % 50 === 0) {
      console.log(`  Processed ${synced}/${records.length}...`);
    }
  }

  // 4. Summary
  console.log("\n=== SYNC SUMMARY ===");
  console.log(`Total records processed: ${synced}`);
  console.log(`New leads created:       ${newRecords}`);
  console.log(`Existing leads updated:  ${synced - newRecords}`);
  console.log(`Payments updated:        ${updatedPayments}`);
  console.log(`Payments created:        ${createdPayments}`);
  console.log(`Errors:                  ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
