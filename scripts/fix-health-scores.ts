// scripts/fix-health-scores.ts
// Run with: npx tsx scripts/fix-health-scores.ts
//
// Refreshes health_score for all active clients using the DB function.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("=== Refresh Health Scores ===\n");

  // Fetch all active clients
  const { data: clients, error: fetchErr } = await supabase
    .from("clients")
    .select("id, nombre, health_score")
    .eq("estado", "activo");

  if (fetchErr) throw new Error(`Failed to fetch clients: ${fetchErr.message}`);

  console.log(`Active clients: ${clients?.length ?? 0}\n`);

  let updated = 0;
  let errors = 0;
  let changed = 0;

  for (const client of clients ?? []) {
    const { data: score, error: rpcErr } = await supabase.rpc(
      "calculate_health_score",
      { client_uuid: client.id }
    );

    if (rpcErr) {
      console.error(`  Error calculating for ${client.id}: ${rpcErr.message}`);
      errors++;
      continue;
    }

    if (score !== null && score !== undefined) {
      const oldScore = client.health_score;
      const { error: updateErr } = await supabase
        .from("clients")
        .update({ health_score: score })
        .eq("id", client.id);

      if (updateErr) {
        console.error(`  Error updating ${client.id}: ${updateErr.message}`);
        errors++;
      } else {
        updated++;
        if (oldScore !== score) {
          changed++;
        }
      }
    }
  }

  console.log("=== HEALTH SCORE SUMMARY ===");
  console.log(`Clients processed: ${updated}`);
  console.log(`Scores changed:    ${changed}`);
  console.log(`Errors:            ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
