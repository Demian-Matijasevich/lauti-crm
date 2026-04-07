// scripts/sync-commissions.ts
// Run with: npx tsx scripts/sync-commissions.ts
//
// Fetches commission data from Airtable "Reporte de Llamadas" and "Base de Clientes",
// aggregates by team member, and writes at_comision_* fields to team_members.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REPORTE_TABLE_ID = "tbleCytRILP3D7Q3N"; // Reporte de Llamadas
const SETTER_TABLE_ID = "tblhr7BbirhvrorZo"; // Setter lookup table
const CLIENTES_TABLE_ID = "tbloD4rZPAyBKoylS"; // Base de Clientes

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── Name → UUID mapping ───────────────────────────
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
  const key = name.toLowerCase().trim();
  return NAME_TO_UUID[key] ?? null;
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

// ─── Main ──────────────────────────────────────────
async function main() {
  console.log("=== Sync Commissions from Airtable ===\n");

  // 1. Fetch Setter table to map record IDs → names
  console.log("Fetching Setter lookup table...");
  const setterRecords = await fetchAllRecords(SETTER_TABLE_ID, ["🙎‍♂️ Nombre Completo"]);
  const setterIdToName = new Map<string, string>();
  for (const rec of setterRecords) {
    const name = rec.fields["🙎‍♂️ Nombre Completo"] as string | undefined;
    if (name) setterIdToName.set(rec.id, name);
  }
  console.log(`  ${setterIdToName.size} setters mapped\n`);

  // 2. Fetch Reporte de Llamadas with commission fields
  console.log("Fetching Reporte de Llamadas...");
  const reporteRecords = await fetchAllRecords(REPORTE_TABLE_ID, [
    "setter del 7 al 7",
    "closer del 7 al 7",
    "👤 Closer",
    "🙎‍♂️ Setter",
  ]);
  console.log(`  ${reporteRecords.length} records fetched\n`);

  // 3. Aggregate commissions
  // closerCommissions: name → total
  // setterCommissions: name → total
  const closerCommissions = new Map<string, number>();
  const setterCommissions = new Map<string, number>();

  for (const rec of reporteRecords) {
    const f = rec.fields;

    // Closer commission
    const closerAmount = Number(f["closer del 7 al 7"] || 0);
    if (closerAmount > 0) {
      const closerField = f["👤 Closer"] as { name?: string } | undefined;
      const closerName = closerField?.name;
      if (closerName) {
        closerCommissions.set(
          closerName,
          (closerCommissions.get(closerName) || 0) + closerAmount
        );
      }
    }

    // Setter commission
    const setterAmount = Number(f["setter del 7 al 7"] || 0);
    if (setterAmount > 0) {
      const setterIds = (f["🙎‍♂️ Setter"] as string[] | undefined) || [];
      for (const sid of setterIds) {
        const setterName = setterIdToName.get(sid);
        if (setterName) {
          setterCommissions.set(
            setterName,
            (setterCommissions.get(setterName) || 0) + setterAmount
          );
        }
      }
    }
  }

  console.log("Closer commissions:");
  for (const [name, amount] of closerCommissions) {
    console.log(`  ${name}: $${amount.toFixed(2)}`);
  }

  console.log("\nSetter commissions:");
  for (const [name, amount] of setterCommissions) {
    console.log(`  ${name}: $${amount.toFixed(2)}`);
  }

  // 4. Fetch Base de Clientes for Mel's cobranzas
  // "Cash collected melanie" is a per-client rollup of cuotas Mel collected in current 7-7 period
  console.log("\nFetching Base de Clientes for Mel's cobranzas...");
  const clienteRecords = await fetchAllRecords(CLIENTES_TABLE_ID, [
    "Cash collected melanie",
  ]);

  let melCashCuotas = 0;
  for (const rec of clienteRecords) {
    const val = Number(rec.fields["Cash collected melanie"] || 0);
    if (val > 0) melCashCuotas += val;
  }

  const melCobranzas = melCashCuotas * 0.10;
  console.log(`  Mel cash cuotas collected: $${melCashCuotas.toFixed(2)}`);
  console.log(`  Mel cobranzas commission (10%): $${melCobranzas.toFixed(2)}`);

  // 5. Build final commission map per UUID
  const commissionMap = new Map<
    string,
    { closer: number; setter: number; cobranzas: number }
  >();

  const ensureEntry = (uuid: string) => {
    if (!commissionMap.has(uuid)) {
      commissionMap.set(uuid, { closer: 0, setter: 0, cobranzas: 0 });
    }
    return commissionMap.get(uuid)!;
  };

  for (const [name, amount] of closerCommissions) {
    const uuid = resolveUUID(name);
    if (uuid) {
      ensureEntry(uuid).closer += amount;
    } else {
      console.warn(`  ⚠ No UUID for closer: "${name}"`);
    }
  }

  for (const [name, amount] of setterCommissions) {
    const uuid = resolveUUID(name);
    if (uuid) {
      ensureEntry(uuid).setter += amount;
    } else {
      console.warn(`  ⚠ No UUID for setter: "${name}"`);
    }
  }

  // Mel's cobranzas
  const melUUID = "dfab6e35-e6b2-4941-8e64-931da9511f3f";
  ensureEntry(melUUID).cobranzas = melCobranzas;

  // 6. Reset all team_members commission fields to 0
  console.log("\nResetting all team_members commission fields...");
  const { error: resetErr } = await supabase
    .from("team_members")
    .update({
      at_comision_closer: 0,
      at_comision_setter: 0,
      at_comision_cobranzas: 0,
      at_comision_total: 0,
    })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // match all

  if (resetErr) {
    console.error(`  Error resetting: ${resetErr.message}`);
  }

  // 7. Update each team member
  console.log("\nUpdating team_members with Airtable commissions...\n");

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

    if (error) {
      console.error(`  Error updating ${uuid}: ${error.message}`);
    } else {
      console.log(
        `  ${uuid}: closer=$${comm.closer.toFixed(2)} setter=$${comm.setter.toFixed(2)} cobranzas=$${comm.cobranzas.toFixed(2)} total=$${total.toFixed(2)}`
      );
    }
  }

  console.log("\n=== DONE ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
