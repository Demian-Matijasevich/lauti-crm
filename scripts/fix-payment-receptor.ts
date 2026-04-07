// scripts/fix-payment-receptor.ts
// Run with: npx tsx scripts/fix-payment-receptor.ts
//
// Reads Airtable "Reporte de Llamadas" field "Recibe" (multiselect)
// and updates receptor on matching payments in Supabase.

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

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}`
    );
    url.searchParams.set("pageSize", "100");
    url.searchParams.append("fields[]", "Recibe");
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

// ─── Main ───────────────────────────────────────────
async function main() {
  console.log("=== Fix Payment Receptor from Airtable ===\n");

  // 1. Fetch Airtable records
  console.log("Fetching Airtable Reporte de Llamadas...");
  const records = await fetchAllAirtableRecords();
  console.log(`Total Airtable records: ${records.length}\n`);

  // 2. Get leads from Supabase (airtable_id → supabase id)
  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, airtable_id");

  if (leadsErr) throw new Error(`Failed to fetch leads: ${leadsErr.message}`);

  const leadMap = new Map<string, string>(); // airtable_id → lead uuid
  for (const l of leads ?? []) {
    if (l.airtable_id) leadMap.set(l.airtable_id, l.id);
  }
  console.log(`Leads in Supabase: ${leadMap.size}\n`);

  // 3. Process updates
  let updated = 0;
  let skipped = 0;
  let noReceptor = 0;
  let errors = 0;

  for (const rec of records) {
    const f = rec.fields;
    const leadId = leadMap.get(rec.id);

    if (!leadId) {
      skipped++;
      continue;
    }

    // "Recibe" is a multiselect array — take the first value
    const recibe = f["Recibe"];
    let receptor: string | null = null;

    if (Array.isArray(recibe) && recibe.length > 0) {
      receptor = String(recibe[0]).trim();
    } else if (typeof recibe === "string" && recibe.trim()) {
      receptor = recibe.trim();
    }

    if (!receptor) {
      noReceptor++;
      continue;
    }

    // Update all payments for this lead
    const { data: updatedPayments, error } = await supabase
      .from("payments")
      .update({ receptor })
      .eq("lead_id", leadId)
      .is("receptor", null)
      .select("id");

    if (error) {
      console.error(`  Error updating payments for lead ${leadId}: ${error.message}`);
      errors++;
    } else {
      updated += updatedPayments?.length ?? 0;
    }
  }

  console.log("=== PAYMENT RECEPTOR SUMMARY ===");
  console.log(`Payments updated:    ${updated}`);
  console.log(`Skipped (no lead):   ${skipped}`);
  console.log(`No receptor value:   ${noReceptor}`);
  console.log(`Errors:              ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
