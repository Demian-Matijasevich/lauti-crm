// scripts/fix-client-data.ts
// Run with: npx tsx scripts/fix-client-data.ts
//
// Fetches "Base de Clientes" from Airtable and updates total_dias_programa,
// llamadas_base, fecha_onboarding, programa, and estado on Supabase clients.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TABLE_ID = "tbloD4rZPAyBKoylS"; // Base de Clientes

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
    // Request specific fields
    for (const f of [
      "Total de Días",
      "Llamadas Base",
      "📆 Fecha de Onboarding",
      "🚀 Programa",
      "📊 Estado",
    ]) {
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
const PROGRAMA_MAP: Record<string, string> = {
  "mentoria 1k pyf": "mentoria_1k_pyf",
  "mentoria 2.5k pyf": "mentoria_2_5k_pyf",
  "mentoria 2.8k pyf": "mentoria_2_8k_pyf",
  "mentoria 5k": "mentoria_5k",
  skool: "skool",
  "vip 5k": "vip_5k",
  "mentoria 2.5k cuotas": "mentoria_2_5k_cuotas",
  "mentoria 5k cuotas": "mentoria_5k_cuotas",
  "mentoria 1k cuotas": "mentoria_1k_cuotas",
  "mentoria fee": "mentoria_fee",
  "cuota vip mantencion": "cuota_vip_mantencion",
  "mentoría 1k pyf": "mentoria_1k_pyf",
  "mentoría 2.5k pyf": "mentoria_2_5k_pyf",
  "mentoría 5k": "mentoria_5k",
  "mentoría fee": "mentoria_fee",
};

const ESTADO_MAP: Record<string, string> = {
  activo: "activo",
  pausado: "pausado",
  inactivo: "inactivo",
  "solo skool": "solo_skool",
  "no termino pagar": "no_termino_pagar",
};

// ─── Main ───────────────────────────────────────────
async function main() {
  console.log("=== Fix Client Data from Airtable ===\n");

  // 1. Fetch all Airtable records
  console.log("Fetching Airtable Base de Clientes...");
  const records = await fetchAllAirtableRecords();
  console.log(`Total Airtable records: ${records.length}\n`);

  // 2. Get existing clients from Supabase
  const { data: existingClients, error: clientsErr } = await supabase
    .from("clients")
    .select("id, airtable_id, total_dias_programa, llamadas_base");

  if (clientsErr)
    throw new Error(`Failed to fetch clients: ${clientsErr.message}`);

  const clientMap = new Map<string, { id: string; total_dias_programa: number | null; llamadas_base: number | null }>();
  for (const c of existingClients ?? []) {
    if (c.airtable_id) clientMap.set(c.airtable_id, c);
  }
  console.log(`Clients in Supabase: ${clientMap.size}\n`);

  // 3. Process updates
  let updated = 0;
  let defaultedDias = 0;
  let defaultedLlamadas = 0;
  let skipped = 0;
  let errors = 0;

  for (const rec of records) {
    const f = rec.fields;
    const client = clientMap.get(rec.id);

    if (!client) {
      skipped++;
      continue;
    }

    const updateData: Record<string, unknown> = {};

    // total_dias_programa
    const totalDias = f["Total de Días"];
    if (totalDias != null && Number(totalDias) > 0) {
      updateData.total_dias_programa = Number(totalDias);
    }

    // llamadas_base
    const llamadasBase = f["Llamadas Base"];
    if (llamadasBase != null && Number(llamadasBase) > 0) {
      updateData.llamadas_base = Number(llamadasBase);
    }

    // fecha_onboarding
    const fechaOnboarding = f["📆 Fecha de Onboarding"] as string | undefined;
    if (fechaOnboarding) {
      updateData.fecha_onboarding = fechaOnboarding;
    }

    // programa
    const programaRaw = ((f["🚀 Programa"] as string) || "").toLowerCase();
    const programa = PROGRAMA_MAP[programaRaw];
    if (programa) {
      updateData.programa = programa;
    }

    // estado
    const estadoRaw = ((f["📊 Estado"] as string) || "").toLowerCase();
    const estado = ESTADO_MAP[estadoRaw];
    if (estado) {
      updateData.estado = estado;
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", client.id);

      if (error) {
        console.error(`  Error updating ${client.id}: ${error.message}`);
        errors++;
      } else {
        updated++;
      }
    }
  }

  // 4. Set defaults for clients without total_dias_programa or llamadas_base
  console.log("\nApplying defaults...");

  const { data: nullDias, error: nullDiasErr } = await supabase
    .from("clients")
    .update({ total_dias_programa: 90 })
    .is("total_dias_programa", null)
    .select("id");

  if (nullDiasErr) {
    console.error(`  Error setting default total_dias_programa: ${nullDiasErr.message}`);
  } else {
    defaultedDias = nullDias?.length ?? 0;
  }

  const { data: nullLlamadas, error: nullLlamadasErr } = await supabase
    .from("clients")
    .update({ llamadas_base: 3 })
    .is("llamadas_base", null)
    .select("id");

  if (nullLlamadasErr) {
    console.error(`  Error setting default llamadas_base: ${nullLlamadasErr.message}`);
  } else {
    defaultedLlamadas = nullLlamadas?.length ?? 0;
  }

  console.log("\n=== CLIENT DATA SUMMARY ===");
  console.log(`Updated from Airtable:  ${updated}`);
  console.log(`Skipped (no client):    ${skipped}`);
  console.log(`Defaulted total_dias:   ${defaultedDias}`);
  console.log(`Defaulted llamadas:     ${defaultedLlamadas}`);
  console.log(`Errors:                 ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
