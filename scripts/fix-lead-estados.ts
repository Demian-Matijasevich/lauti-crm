// scripts/fix-lead-estados.ts
// Run with: npx tsx scripts/fix-lead-estados.ts
//
// Fixes: all leads have estado='pendiente' after migration.
// Fetches real estados from Airtable and updates Supabase.

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

const REPORTE_TABLE_ID = "tbleCytRILP3D7Q3N";

// ─── Airtable fetch with pagination ────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchAllRecords(tableId: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(`Airtable API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    allRecords.push(...data.records);
    offset = data.offset;
    console.log(`  Fetched ${allRecords.length} records...`);
  } while (offset);

  return allRecords;
}

// ─── Estado mapping ────────────────────────────────
type LeadEstado =
  | "pendiente" | "no_show" | "cancelada" | "reprogramada" | "seguimiento"
  | "no_calificado" | "no_cierre" | "reserva" | "cerrado"
  | "adentro_seguimiento" | "broke_cancelado";

function mapEstado(raw: string | undefined | null): LeadEstado {
  if (!raw) return "pendiente";
  const lower = raw.toLowerCase().trim();

  if (lower.includes("cerrado")) return "cerrado";
  if (lower.includes("reserva")) return "reserva";
  if (lower.includes("no-show") || lower.includes("no show")) return "no_show";
  if (lower.includes("cancelada")) return "cancelada";
  if (lower.includes("re-programada") || lower.includes("reprogramada")) return "reprogramada";
  if (lower.includes("adentro en seguimiento") || lower.includes("adentro_seguimiento")) return "adentro_seguimiento";
  if (lower.includes("seguimiento")) return "seguimiento";
  if (lower.includes("no calificado") && lower.includes("no cierre")) return "no_calificado";
  if (lower.includes("no calificado")) return "no_calificado";
  if (lower.includes("no cierre")) return "no_cierre";
  if (lower.includes("broke") || lower.includes("cancelado")) return "broke_cancelado";
  if (lower.includes("pendiente")) return "pendiente";

  console.warn(`  Unknown estado: "${raw}" → defaulting to pendiente`);
  return "pendiente";
}

type LeadCalificacion = "calificado" | "no_calificado" | "podria";

function mapCalificacion(raw: string | undefined | null): LeadCalificacion | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();

  if (lower.includes("no calificado")) return "no_calificado";
  if (lower.includes("calificado")) return "calificado";
  if (lower.includes("podri")) return "podria";

  console.warn(`  Unknown calificacion: "${raw}" → null`);
  return null;
}

// ─── Main ──────────────────────────────────────────
async function main() {
  console.log("=== Fix Lead Estados ===\n");

  // 1. Fetch all records from Airtable "Reporte de Llamadas"
  console.log("Fetching Airtable records...");
  const records = await fetchAllRecords(REPORTE_TABLE_ID);
  console.log(`Total Airtable records: ${records.length}\n`);

  // 2. Build update map: airtable_id → { estado, lead_calificado }
  const updates: { airtable_id: string; estado: LeadEstado; lead_calificado: LeadCalificacion | null }[] = [];
  const estadoStats: Record<string, number> = {};
  const calificacionStats: Record<string, number> = {};

  for (const rec of records) {
    const rawEstado = rec.fields["📌 Estado de la Llamada"] as string | undefined;
    const rawCalificacion = rec.fields["📌Lead Calificado?"] as string | undefined;

    const estado = mapEstado(rawEstado);
    const calificacion = mapCalificacion(rawCalificacion);

    estadoStats[estado] = (estadoStats[estado] || 0) + 1;
    if (calificacion) calificacionStats[calificacion] = (calificacionStats[calificacion] || 0) + 1;

    updates.push({
      airtable_id: rec.id,
      estado,
      lead_calificado: calificacion,
    });
  }

  console.log("Estado distribution:");
  for (const [k, v] of Object.entries(estadoStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\nCalificacion distribution:`);
  for (const [k, v] of Object.entries(calificacionStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  // 3. Update Supabase leads by airtable_id
  console.log(`\nUpdating ${updates.length} leads in Supabase...`);
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  // Batch by 50 to avoid overwhelming the API
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    const promises = batch.map(async (u) => {
      const updateData: Record<string, unknown> = { estado: u.estado };
      if (u.lead_calificado !== null) {
        updateData.lead_calificado = u.lead_calificado;
      }

      const { data, error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("airtable_id", u.airtable_id)
        .select("id");

      if (error) {
        console.error(`  Error updating ${u.airtable_id}:`, error.message);
        errors++;
      } else if (!data || data.length === 0) {
        notFound++;
      } else {
        updated++;
      }
    });

    await Promise.all(promises);
    if ((i + 50) % 200 === 0 || i + 50 >= updates.length) {
      console.log(`  Progress: ${Math.min(i + 50, updates.length)}/${updates.length}`);
    }
  }

  console.log(`\nResults: ${updated} updated, ${notFound} not found in Supabase, ${errors} errors`);

  // 4. Clean up empty team member
  console.log("\n=== Clean up team members ===");

  // Deactivate empty-name team members
  const { data: deactivated, error: deactErr } = await supabase
    .from("team_members")
    .update({ activo: false })
    .eq("nombre", "")
    .select("id, nombre");

  if (deactErr) {
    console.error("Error deactivating empty team member:", deactErr.message);
  } else {
    console.log(`Deactivated ${deactivated?.length || 0} empty team members`);
  }

  // Also try null names
  const { data: deactivated2, error: deactErr2 } = await supabase
    .from("team_members")
    .update({ activo: false })
    .is("nombre", null)
    .select("id, nombre");

  if (deactErr2) {
    console.error("Error deactivating null-name team member:", deactErr2.message);
  } else {
    console.log(`Deactivated ${deactivated2?.length || 0} null-name team members`);
  }

  // Set Hernan as closer
  const { data: hernan, error: hernanErr } = await supabase
    .from("team_members")
    .update({ is_closer: true })
    .ilike("nombre", "%hernan%")
    .select("id, nombre");

  if (hernanErr) {
    console.error("Error setting Hernan as closer:", hernanErr.message);
  } else {
    console.log(`Set is_closer=true for: ${hernan?.map((h) => h.nombre).join(", ") || "none found"}`);
  }

  // 5. Verify final estado distribution in Supabase
  console.log("\n=== Verification: Supabase estado distribution ===");
  const { data: leadStats } = await supabase
    .from("leads")
    .select("estado");

  if (leadStats) {
    const dist: Record<string, number> = {};
    for (const l of leadStats) {
      dist[l.estado] = (dist[l.estado] || 0) + 1;
    }
    for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${v}`);
    }
    console.log(`  Total: ${leadStats.length}`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
