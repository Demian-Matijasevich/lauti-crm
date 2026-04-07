// scripts/fix-payment-client-link.ts
// Run with: npx tsx scripts/fix-payment-client-link.ts
//
// Links payments to clients by matching lead_id.
// For each client with a lead_id, sets client_id on all payments with that lead_id.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("=== Fix Payment → Client Link ===\n");

  // 1. Fetch all clients with lead_id
  const { data: clients, error: clientsErr } = await supabase
    .from("clients")
    .select("id, lead_id")
    .not("lead_id", "is", null);

  if (clientsErr) throw new Error(`Failed to fetch clients: ${clientsErr.message}`);
  console.log(`Clients with lead_id: ${clients?.length ?? 0}`);

  // 2. Fetch all payments without client_id
  const { data: payments, error: paymentsErr } = await supabase
    .from("payments")
    .select("id, lead_id")
    .is("client_id", null)
    .not("lead_id", "is", null);

  if (paymentsErr) throw new Error(`Failed to fetch payments: ${paymentsErr.message}`);
  console.log(`Payments without client_id: ${payments?.length ?? 0}\n`);

  // 3. Build lead_id → client_id map
  const leadToClient = new Map<string, string>();
  for (const c of clients ?? []) {
    if (c.lead_id) leadToClient.set(c.lead_id, c.id);
  }

  // 4. Update payments
  let updated = 0;
  let noMatch = 0;
  let errors = 0;

  for (const p of payments ?? []) {
    const clientId = leadToClient.get(p.lead_id);
    if (!clientId) {
      noMatch++;
      continue;
    }

    const { error } = await supabase
      .from("payments")
      .update({ client_id: clientId })
      .eq("id", p.id);

    if (error) {
      console.error(`  Error updating payment ${p.id}: ${error.message}`);
      errors++;
    } else {
      updated++;
    }
  }

  console.log("=== PAYMENT-CLIENT LINK SUMMARY ===");
  console.log(`Payments linked:     ${updated}`);
  console.log(`No client match:     ${noMatch}`);
  console.log(`Errors:              ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
