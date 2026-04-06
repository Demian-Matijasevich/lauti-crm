// scripts/validate-migration.ts
// Run with: npx tsx scripts/validate-migration.ts

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) continue;
  process.env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── Airtable Helpers ──────────────────────────────
interface AirtableResponse {
  records: Array<{ id: string; fields: Record<string, unknown> }>;
  offset?: string;
}

async function countAirtable(tableId: string): Promise<number> {
  let count = 0;
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("fields[]", ""); // minimal fields
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!response.ok) throw new Error(`Airtable ${response.status}`);
    const data = (await response.json()) as AirtableResponse;
    count += data.records.length;
    offset = data.offset;
  } while (offset);

  return count;
}

async function countSupabase(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function sumAirtableCash(): Promise<number> {
  let total = 0;
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tbleCytRILP3D7Q3N`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!response.ok) throw new Error(`Airtable ${response.status}`);
    const data = (await response.json()) as AirtableResponse;

    for (const r of data.records) {
      const f = r.fields;
      if (((f["\uD83D\uDCCA Estado 1"] as string) || "").toLowerCase() === "pagado") {
        total += (f["\uD83D\uDCB0 Pago 1"] as number) || 0;
      }
      if (((f["\uD83D\uDCCA Estado 2"] as string) || "").toLowerCase() === "pagado") {
        total += (f["\uD83D\uDCB0 Pago 2"] as number) || 0;
      }
      if (((f["\uD83D\uDCCA Estado 3"] as string) || "").toLowerCase() === "pagado") {
        total += (f["\uD83D\uDCB0 Pago 3"] as number) || 0;
      }
    }

    offset = data.offset;
  } while (offset);

  return total;
}

async function sumSupabaseCash(): Promise<number> {
  const { data, error } = await supabase
    .from("payments")
    .select("monto_usd")
    .eq("estado", "pagado");
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + (row.monto_usd || 0), 0);
}

// ─── Validation checks ─────────────────────────────
interface Check {
  name: string;
  airtable: number;
  supabase: number;
  match: boolean;
  delta: number;
}

async function runValidation() {
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551   Lauti CRM \u2014 Migration Validation Report   \u2551");
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  console.log("");

  const checks: Check[] = [];

  // 1. Leads count
  const atLeads = await countAirtable("tbleCytRILP3D7Q3N");
  const sbLeads = await countSupabase("leads");
  checks.push({
    name: "Total Leads",
    airtable: atLeads,
    supabase: sbLeads,
    match: atLeads === sbLeads,
    delta: sbLeads - atLeads,
  });

  // 2. Clients count
  const atClients = await countAirtable("tbloD4rZPAyBKoylS");
  const sbClients = await countSupabase("clients");
  checks.push({
    name: "Total Clients",
    airtable: atClients,
    supabase: sbClients,
    match: atClients === sbClients,
    delta: sbClients - atClients,
  });

  // 3. Cash collected
  const atCash = await sumAirtableCash();
  const sbCash = await sumSupabaseCash();
  const cashMatch = Math.abs(atCash - sbCash) < 0.01;
  checks.push({
    name: "Total Cash Collected (USD)",
    airtable: Math.round(atCash * 100) / 100,
    supabase: Math.round(sbCash * 100) / 100,
    match: cashMatch,
    delta: Math.round((sbCash - atCash) * 100) / 100,
  });

  // 4. Payments count (Supabase should have more because of normalization)
  const sbPayments = await countSupabase("payments");
  checks.push({
    name: "Total Payment Records",
    airtable: -1, // N/A — normalized
    supabase: sbPayments,
    match: sbPayments > 0,
    delta: 0,
  });

  // 5. Tracker sessions
  const atSessions = await countAirtable("tblln5DRvO6iZBdLa");
  const sbSessions = await countSupabase("tracker_sessions");
  checks.push({
    name: "Total Tracker Sessions",
    airtable: atSessions,
    supabase: sbSessions,
    match: atSessions === sbSessions,
    delta: sbSessions - atSessions,
  });

  // 6. Daily Reports
  const atReports = await countAirtable("tblpfZMziou1Ny9sU");
  const sbReports = await countSupabase("daily_reports");
  checks.push({
    name: "Total Daily Reports",
    airtable: atReports,
    supabase: sbReports,
    match: atReports === sbReports,
    delta: sbReports - atReports,
  });

  // 7. IG Metrics
  const atIG = await countAirtable("tbl17rny30qYztVo3");
  const sbIG = await countSupabase("ig_metrics");
  checks.push({
    name: "Total IG Metrics",
    airtable: atIG,
    supabase: sbIG,
    match: atIG === sbIG,
    delta: sbIG - atIG,
  });

  // 8. Renewal History
  const atRenewals = await countAirtable("tblDSzP54VuEfce8e");
  const sbRenewals = await countSupabase("renewal_history");
  checks.push({
    name: "Total Renewal History",
    airtable: atRenewals,
    supabase: sbRenewals,
    match: atRenewals === sbRenewals,
    delta: sbRenewals - atRenewals,
  });

  // 9. Verify 7-7 monthly cash view works
  let viewCheck = false;
  try {
    const { data, error } = await supabase.from("v_monthly_cash").select("*").limit(1);
    viewCheck = !error && data !== null;
  } catch {
    viewCheck = false;
  }

  // ─── Print Report ─────────────────────────────────
  console.log("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("\u2502 Check                       \u2502 Airtable \u2502 Supabase \u2502 Match  \u2502 Delta \u2502");
  console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  for (const c of checks) {
    const name = c.name.padEnd(27);
    const at = c.airtable === -1 ? "N/A".padStart(8) : String(c.airtable).padStart(8);
    const sb = String(c.supabase).padStart(8);
    const match = c.match ? "  OK  " : " FAIL ";
    const delta = c.delta === 0 ? "    0" : String(c.delta > 0 ? `+${c.delta}` : c.delta).padStart(5);
    console.log(`\u2502 ${name} \u2502 ${at} \u2502 ${sb} \u2502 ${match} \u2502 ${delta} \u2502`);
  }
  console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  console.log(`\u2502 v_monthly_cash view works   \u2502          \u2502          \u2502 ${viewCheck ? "  OK  " : " FAIL "} \u2502       \u2502`);
  console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");

  const failures = checks.filter((c) => !c.match);
  console.log("");
  if (failures.length === 0 && viewCheck) {
    console.log("ALL CHECKS PASSED. Migration validated successfully.");
  } else {
    console.log(`${failures.length} check(s) failed:`);
    for (const f of failures) {
      console.log(`  - ${f.name}: Airtable=${f.airtable}, Supabase=${f.supabase}, Delta=${f.delta}`);
    }
    if (!viewCheck) {
      console.log("  - v_monthly_cash view is not working");
    }
    process.exit(1);
  }
}

runValidation().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
