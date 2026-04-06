// scripts/fix-closer-setter.ts
// Fix closer_id, setter_id, and cobrador_id mapping on leads
// Run with: npx tsx scripts/fix-closer-setter.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── Known team_member UUIDs ───────────────────────
const TEAM: Record<string, string> = {
  lauti: "3346163c-83a5-4156-ac3a-917197cd31b0",
  mel: "dfab6e35-e6b2-4941-8e64-931da9511f3f",
  juanma: "4e32ceda-e0ce-4b56-bf53-da5d59aa384b",
  ivan: "9ddbc3a1-6a98-435e-baa1-bfeb23172317",
  joaquin: "49f9c067-22f2-4e87-a343-01a768fd9004",
  jorge: "8f42f8d8-47c3-42fe-9c86-4d75df18c64a",
  pepito: "4cfe8efc-64d3-4dc5-9fd4-d4c1fdb295b5",
};

// Will be populated after creating new team members
let hernanId: string;
let juanGoupilId: string;

// ─── Step 1: Create missing team members ───────────
async function createMissingTeamMembers() {
  console.log("=== Creating missing team members ===");

  // Hernan — upsert (check first to avoid duplicates)
  const { data: existingHernan } = await supabase
    .from("team_members")
    .select("id")
    .eq("nombre", "Hernan")
    .single();

  if (existingHernan) {
    hernanId = existingHernan.id;
    console.log(`  Hernan already exists: ${hernanId}`);
  } else {
    const { data: hernan, error: e1 } = await supabase
      .from("team_members")
      .insert({
        nombre: "Hernan",
        is_closer: false,
        is_setter: false,
        pin: "5001",
        activo: true,
      })
      .select("id")
      .single();
    if (e1) throw new Error(`Failed to create Hernan: ${e1.message}`);
    hernanId = hernan.id;
    console.log(`  Created Hernan: ${hernanId}`);
  }

  // Juan Goupil — upsert (check first to avoid duplicates)
  const { data: existingJG } = await supabase
    .from("team_members")
    .select("id")
    .eq("nombre", "Juan Goupil")
    .single();

  if (existingJG) {
    juanGoupilId = existingJG.id;
    console.log(`  Juan Goupil already exists: ${juanGoupilId}`);
  } else {
    const { data: jg, error: e2 } = await supabase
      .from("team_members")
      .insert({
        nombre: "Juan Goupil",
        is_closer: false,
        is_setter: true,
        pin: "5002",
        activo: true,
      })
      .select("id")
      .single();
    if (e2) throw new Error(`Failed to create Juan Goupil: ${e2.message}`);
    juanGoupilId = jg.id;
    console.log(`  Created Juan Goupil: ${juanGoupilId}`);
  }
}

// ─── Closer name → UUID mapping ────────────────────
function mapCloserName(name: string): string | null {
  const n = name.toLowerCase().trim();
  if (n.includes("ivan carbone")) return TEAM.ivan;
  if (n.includes("joaqu") && n.includes("izcurdia")) return TEAM.joaquin;
  if (n.includes("jorge") && n.includes("pal")) return TEAM.jorge;
  if (n.includes("lautaro cardozo")) return TEAM.lauti;
  if (n.includes("juan martin wohl") || n.includes("wohl")) return TEAM.juanma;
  if (n.includes("hernan")) return hernanId;
  if (n.includes("melanie") || n === "mel" || n === "m c") return TEAM.mel;
  console.warn(`  ⚠ Unknown closer name: "${name}"`);
  return null;
}

// ─── Setter record ID → UUID mapping ───────────────
function mapSetterRecordId(recId: string): string | null {
  const SETTER_MAP: Record<string, string> = {
    recDCuKteFEdPDQMb: TEAM.joaquin,
    reczYIix6ayoO4rgq: TEAM.jorge,
    rec1gFZWXR0nDUSYS: juanGoupilId,
    rectUVql5X9yz9caD: TEAM.juanma,
  };
  const mapped = SETTER_MAP[recId];
  if (!mapped) {
    console.warn(`  ⚠ Unknown setter record: "${recId}"`);
  }
  return mapped || null;
}

// ─── Cobrador collaborator name → UUID mapping ─────
function mapCobradorName(name: string): string | null {
  // Same logic as closer — it's a collaborator field
  return mapCloserName(name);
}

// ─── Fetch all Airtable records with pagination ────
async function fetchAllAirtableRecords(): Promise<any[]> {
  const TABLE_ID = "tbleCytRILP3D7Q3N";
  const allRecords: any[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}`
    );
    url.searchParams.set("pageSize", "100");
    url.searchParams.set(
      "fields[]",
      "👤 Closer"
    );
    url.searchParams.append("fields[]", "🙎‍♂️ Setter");
    url.searchParams.append("fields[]", "👤 Cobro de Cuotas");
    if (offset) url.searchParams.set("offset", offset);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Airtable API error ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    allRecords.push(...data.records);
    offset = data.offset;
    console.log(`  Fetched ${allRecords.length} records so far...`);
  } while (offset);

  return allRecords;
}

// ─── Main ──────────────────────────────────────────
async function main() {
  console.log("=== Fix closer_id, setter_id, cobrador_id ===\n");

  await createMissingTeamMembers();

  console.log("\n=== Fetching leads from Airtable ===");
  const records = await fetchAllAirtableRecords();
  console.log(`  Total Airtable records: ${records.length}`);

  // Build updates
  const updates: {
    airtable_id: string;
    closer_id: string | null;
    setter_id: string | null;
    cobrador_id: string | null;
  }[] = [];

  let closersMapped = 0;
  let settersMapped = 0;
  let cobradoresMapped = 0;
  let closersMissing = 0;
  let settersMissing = 0;

  for (const record of records) {
    const f = record.fields;
    let closerId: string | null = null;
    let setterId: string | null = null;
    let cobradorId: string | null = null;

    // Closer is a collaborator object { id, email, name }
    const closerField = f["👤 Closer"];
    if (closerField && closerField.name) {
      closerId = mapCloserName(closerField.name);
      if (closerId) closersMapped++;
      else closersMissing++;
    }

    // Setter is a linked record array
    const setterField = f["🙎‍♂️ Setter"];
    if (setterField && Array.isArray(setterField) && setterField.length > 0) {
      setterId = mapSetterRecordId(setterField[0]);
      if (setterId) settersMapped++;
      else settersMissing++;
    }

    // Cobrador is a collaborator object
    const cobradorField = f["👤 Cobro de Cuotas"];
    if (cobradorField && cobradorField.name) {
      cobradorId = mapCobradorName(cobradorField.name);
      if (cobradorId) cobradoresMapped++;
    }

    updates.push({
      airtable_id: record.id,
      closer_id: closerId,
      setter_id: setterId,
      cobrador_id: cobradorId,
    });
  }

  // ─── Batch update in Supabase ──────────────────
  console.log("\n=== Updating leads in Supabase ===");
  const BATCH_SIZE = 100;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    // Supabase doesn't support batch update by arbitrary column,
    // so we do individual updates but parallelize within each batch
    const results = await Promise.all(
      batch.map(async (u) => {
        const updateData: Record<string, string | null> = {};
        // Always set all three fields (even if null to clear bad data)
        updateData.closer_id = u.closer_id;
        updateData.setter_id = u.setter_id;
        updateData.cobrador_id = u.cobrador_id;

        const { error } = await supabase
          .from("leads")
          .update(updateData)
          .eq("airtable_id", u.airtable_id);

        if (error) {
          console.error(
            `  Error updating ${u.airtable_id}: ${error.message}`
          );
          return false;
        }
        return true;
      })
    );

    const batchOk = results.filter(Boolean).length;
    totalUpdated += batchOk;
    totalErrors += results.length - batchOk;
    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchOk}/${batch.length} updated`
    );
  }

  // ─── Stats ─────────────────────────────────────
  console.log("\n=== DONE ===");
  console.log(`  Total Airtable records: ${records.length}`);
  console.log(`  Leads updated in Supabase: ${totalUpdated}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`  Closers mapped: ${closersMapped}`);
  console.log(`  Closers missing/unknown: ${closersMissing}`);
  console.log(`  Setters mapped: ${settersMapped}`);
  console.log(`  Setters missing/unknown: ${settersMissing}`);
  console.log(`  Cobradores mapped: ${cobradoresMapped}`);
  console.log(`  New team members: Hernan (${hernanId}), Juan Goupil (${juanGoupilId})`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
