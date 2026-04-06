// scripts/fix-renovations.ts
// Creates payment records with es_renovacion = true from Airtable "Base de Clientes" renovation fields.
// Run with: npx tsx scripts/fix-renovations.ts

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "crypto";
import * as path from "path";

// Load .env.local
config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const TABLE_ID = "tbloD4rZPAyBKoylS"; // Base de Clientes

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── Airtable fetch with pagination ────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
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
      throw new Error(`Airtable API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    all.push(...data.records);
    offset = data.offset;
    console.log(`  Fetched ${all.length} client records...`);
  } while (offset);

  return all;
}

// ─── Main ──────────────────────────────────────────
async function main() {
  console.log("=== Fix Renovations: Creating payment records ===\n");

  // 1. Get all clients from Supabase to build airtable_id -> client mapping
  const { data: clients, error: clientErr } = await supabase
    .from("clients")
    .select("id, airtable_id, lead_id, nombre");

  if (clientErr) {
    console.error("Error fetching clients:", clientErr);
    process.exit(1);
  }

  const airtableToClient: Record<
    string,
    { id: string; lead_id: string | null; nombre: string }
  > = {};
  for (const c of clients ?? []) {
    if (c.airtable_id) {
      airtableToClient[c.airtable_id] = {
        id: c.id,
        lead_id: c.lead_id,
        nombre: c.nombre,
      };
    }
  }
  console.log(`Loaded ${Object.keys(airtableToClient).length} clients with airtable_id\n`);

  // 2. Fetch renovation data from Airtable (Base de Clientes)
  const records = await fetchAllRecords();
  console.log(`\nTotal Airtable client records: ${records.length}\n`);

  // 3. Build payment rows for renovation cuotas
  const paymentRows: Record<string, unknown>[] = [];
  let skipped = 0;
  let processed = 0;

  for (const record of records) {
    const f = record.fields;
    const client = airtableToClient[record.id];

    if (!client) {
      // No matching Supabase client
      continue;
    }

    // Define the 3 renovation cuotas with their field mappings
    const cuotas = [
      {
        num: 1,
        monto_usd: f["Renovacion"] as number | undefined,
        monto_ars: f["Renovacion en pesos"] as number | undefined,
        fecha: f["📆 Fecha en que pago la Renovación"] as string | undefined,
        estado: f["Estado de Renovacion 1"] as string | undefined,
      },
      {
        num: 2,
        monto_usd: f["Renovacion Cuota 2"] as number | undefined,
        monto_ars: f["Renovacion Cuota 2 en Pesos"] as number | undefined,
        fecha: f["📆 Fecha en que pago la Renovación Cuota 2"] as string | undefined,
        estado: f["Estado de Renovacion 2"] as string | undefined,
      },
      {
        num: 3,
        monto_usd: f["Renovacion Cuota 3"] as number | undefined,
        monto_ars: null,
        fecha: f["📆 Fecha en que pago la Renovación Cuota 3"] as string | undefined,
        estado: f["Estado de Renovacion 3"] as string | undefined,
      },
    ];

    for (const cuota of cuotas) {
      if (!cuota.monto_usd && !cuota.fecha) continue;

      const estadoLower = (cuota.estado || "").toLowerCase();

      // Only create payment if estado indicates it was paid
      const isPaid =
        estadoLower === "pago" ||
        estadoLower.includes("pagada");

      if (!isPaid) {
        skipped++;
        continue;
      }

      // Check for existing renovation payment to avoid duplicates
      // (match on client_id + es_renovacion + numero_cuota + monto_usd)
      paymentRows.push({
        id: randomUUID(),
        lead_id: client.lead_id,
        client_id: client.id,
        renewal_id: null,
        numero_cuota: cuota.num,
        monto_usd: cuota.monto_usd || 0,
        monto_ars: cuota.monto_ars || 0,
        fecha_pago: cuota.fecha || null,
        fecha_vencimiento: null,
        estado: "pagado",
        metodo_pago: null,
        receptor: null,
        comprobante_url: null,
        cobrador_id: null,
        verificado: false,
        es_renovacion: true,
      });

      processed++;
    }
  }

  console.log(`Renovation payments to create: ${paymentRows.length}`);
  console.log(`Skipped (not paid): ${skipped}`);

  if (paymentRows.length === 0) {
    console.log("\nNo renovation payments to insert. Done.");
    return;
  }

  // 4. Delete existing renovation payments to avoid duplicates on re-run
  const { error: delErr } = await supabase
    .from("payments")
    .delete()
    .eq("es_renovacion", true);

  if (delErr) {
    console.error("Error cleaning existing renovation payments:", delErr);
    process.exit(1);
  }
  console.log("Cleaned existing renovation payments.");

  // 5. Insert in batches of 500
  const BATCH = 500;
  for (let i = 0; i < paymentRows.length; i += BATCH) {
    const batch = paymentRows.slice(i, i + BATCH);
    const { error } = await supabase.from("payments").insert(batch);
    if (error) {
      console.error(`Error inserting batch ${i}:`, error);
      process.exit(1);
    }
    console.log(`  Inserted batch ${i + 1}-${Math.min(i + BATCH, paymentRows.length)}`);
  }

  console.log(`\n=== Done! Created ${paymentRows.length} renovation payment records ===`);

  // 6. Quick validation
  const { data: stats } = await supabase
    .from("payments")
    .select("monto_usd, es_renovacion")
    .eq("es_renovacion", true)
    .eq("estado", "pagado");

  const totalRenov = (stats ?? []).reduce(
    (sum, p) => sum + Number(p.monto_usd),
    0
  );
  console.log(`\nValidation: Total renovation cash = $${totalRenov.toFixed(2)}`);
  console.log(`Renovation payment count = ${(stats ?? []).length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
