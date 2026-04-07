// scripts/import-airtable-7-7.ts
// Run with: npx tsx scripts/import-airtable-7-7.ts
//
// Imports Airtable's pre-calculated "del 7 al 7" cash collected values
// into Supabase leads table for auditing comparison.

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

async function fetchAllAirtableRecords(): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}`
    );
    // Only request the fields we need
    url.searchParams.append(
      "fields[]",
      "\u{1F3C6} Cash Collected del 7 al 7"
    );
    url.searchParams.append(
      "fields[]",
      "\u{1F3C6} Cash Collected del 7 al 7 Cuotas"
    );
    if (offset) url.searchParams.append("offset", offset);

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

async function main() {
  console.log("=== Import Airtable 7-7 Values ===\n");

  // 1. Fetch all Airtable records
  console.log("Fetching Airtable records...");
  const records = await fetchAllAirtableRecords();
  console.log(`Total Airtable records: ${records.length}\n`);

  // 2. Build updates
  const updates: {
    airtable_id: string;
    at_cash_7_7: number;
    at_cash_cuotas_7_7: number;
    at_cash_total: number;
  }[] = [];

  for (const rec of records) {
    const cash77 = Number(
      rec.fields["\u{1F3C6} Cash Collected del 7 al 7"] || 0
    );
    const cashCuotas77 = Number(
      rec.fields["\u{1F3C6} Cash Collected del 7 al 7 Cuotas"] || 0
    );
    const total = cash77 + cashCuotas77;

    // Only include records that have some value
    if (cash77 !== 0 || cashCuotas77 !== 0) {
      updates.push({
        airtable_id: rec.id,
        at_cash_7_7: cash77,
        at_cash_cuotas_7_7: cashCuotas77,
        at_cash_total: total,
      });
    }
  }

  console.log(`Records with cash values: ${updates.length}\n`);

  // 3. Batch update Supabase in groups of 100
  let totalUpdated = 0;
  let sumCash77 = 0;
  let sumCuotas77 = 0;

  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);

    for (const item of batch) {
      const { error } = await supabase
        .from("leads")
        .update({
          at_cash_7_7: item.at_cash_7_7,
          at_cash_cuotas_7_7: item.at_cash_cuotas_7_7,
          at_cash_total: item.at_cash_total,
        })
        .eq("airtable_id", item.airtable_id);

      if (error) {
        console.error(
          `  Error updating ${item.airtable_id}: ${error.message}`
        );
      } else {
        totalUpdated++;
        sumCash77 += item.at_cash_7_7;
        sumCuotas77 += item.at_cash_cuotas_7_7;
      }
    }

    console.log(
      `  Batch ${Math.floor(i / 100) + 1}: updated ${Math.min(i + 100, updates.length)}/${updates.length}`
    );
  }

  // 4. Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Total leads updated: ${totalUpdated}`);
  console.log(
    `Sum at_cash_7_7 (ventas nuevas):  $${sumCash77.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  );
  console.log(
    `Sum at_cash_cuotas_7_7 (cuotas):  $${sumCuotas77.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  );
  console.log(
    `Sum TOTAL:                        $${(sumCash77 + sumCuotas77).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
