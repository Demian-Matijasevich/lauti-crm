// scripts/migrate-airtable.ts
// Run with: npx tsx scripts/migrate-airtable.ts
//
// Requires .env.local with:
//   AIRTABLE_TOKEN=pat5Y573VThWz66cc.63b99c92b43ab7bda2400846ba5e211ac9c25dd85e42bc784da05f020310e299
//   AIRTABLE_BASE_ID=appRlYaISIRx0QEVe
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// ─── Config ─────────────────────────────────────────
// Load .env.local manually
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex);
  const value = trimmed.slice(eqIndex + 1);
  process.env[key] = value;
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── ID Maps ────────────────────────────────────────
// Maps Airtable record IDs to Supabase UUIDs
const idMap: Record<string, string> = {};
// Maps Airtable collaborator IDs/names to team_member UUIDs
const teamMap: Record<string, string> = {};

// ─── Logging ────────────────────────────────────────
const LOG_FILE = path.resolve(__dirname, "../migration.log");
let logStream: fs.WriteStream;

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream?.write(line + "\n");
}

function logError(msg: string, err?: unknown) {
  const line = `[${new Date().toISOString()}] ERROR: ${msg} ${err ? JSON.stringify(err) : ""}`;
  console.error(line);
  logStream?.write(line + "\n");
}

// ─── Airtable Fetch with Pagination (using fetch()) ─
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

async function fetchAllRecords(tableId: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable API error ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as AirtableResponse;
    allRecords.push(...data.records);
    offset = data.offset;
    log(`  Fetched ${allRecords.length} records from ${tableId}...`);
  } while (offset);

  return allRecords;
}

// ─── Supabase Upsert Helper ─────────────────────────
async function upsertBatch(table: string, rows: Record<string, unknown>[], conflictColumn = "airtable_id") {
  if (rows.length === 0) return;
  // Upsert in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictColumn });
    if (error) {
      logError(`Upsert ${table} batch ${i}/${rows.length}`, error);
      throw error;
    }
  }
  log(`  Upserted ${rows.length} rows into ${table}`);
}

// ─── Attachment handler ─────────────────────────────
async function migrateAttachment(
  attachments: Array<{ url: string; filename: string; type: string }> | undefined,
  bucket: string,
  prefix: string
): Promise<string | null> {
  if (!attachments || attachments.length === 0) return null;
  const att = attachments[0]; // Take first attachment
  try {
    const response = await fetch(att.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const ext = att.filename.split(".").pop() || "bin";
    const storagePath = `${prefix}/${randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType: att.type || "application/octet-stream",
      upsert: true,
    });

    if (error) {
      logError(`Upload attachment ${att.filename}`, error);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    logError(`Migrate attachment ${att.filename}`, err);
    return null;
  }
}

// ─── Helper: resolve collaborator to team_member ID ─
function resolveCollaborator(field: unknown): string | null {
  if (!field) return null;
  const collab = field as { name?: string; email?: string; id?: string };
  const name = (collab.name || collab.email || collab.id || "").toLowerCase();
  return teamMap[name] || null;
}

// ─── Helper: resolve record link to UUID ────────────
function resolveRecordLink(field: unknown): string | null {
  if (!field) return null;
  if (Array.isArray(field) && field.length > 0) {
    return idMap[field[0]] || null;
  }
  if (typeof field === "string") {
    return idMap[field] || null;
  }
  return null;
}

// ─── Enum Mappings ──────────────────────────────────
const ESTADO_LLAMADA_MAP: Record<string, string> = {
  pendiente: "pendiente",
  "no show": "no_show",
  no_show: "no_show",
  cancelada: "cancelada",
  reprogramada: "reprogramada",
  seguimiento: "seguimiento",
  "no calificado": "no_calificado",
  no_calificado: "no_calificado",
  "no cierre": "no_cierre",
  no_cierre: "no_cierre",
  reserva: "reserva",
  cerrado: "cerrado",
  "adentro seguimiento": "adentro_seguimiento",
  "broke/cancelado": "broke_cancelado",
  broke_cancelado: "broke_cancelado",
};

const PAYMENT_ESTADO_MAP: Record<string, string> = {
  pagado: "pagado",
  pendiente: "pendiente",
  perdido: "perdido",
  "no pagado": "pendiente",
};

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

const FUENTE_MAP: Record<string, string> = {
  historias: "historias",
  "lead magnet": "lead_magnet",
  youtube: "youtube",
  instagram: "instagram",
  "dm directo": "dm_directo",
  "historia cta": "historia_cta",
  "historia hr": "historia_hr",
  "comentario manychat": "comentario_manychat",
  encuesta: "encuesta",
  "why now": "why_now",
  win: "win",
  fup: "fup",
  whatsapp: "whatsapp",
  otro: "otro",
};

const PLAN_PAGO_MAP: Record<string, string> = {
  "paid in full": "paid_in_full",
  pif: "paid_in_full",
  "2 cuotas": "2_cuotas",
  "3 cuotas": "3_cuotas",
  personalizado: "personalizado",
};

const CONCEPTO_MAP: Record<string, string> = {
  pif: "pif",
  fee: "fee",
  "primera cuota": "primera_cuota",
  "segunda cuota": "segunda_cuota",
  "1ra cuota": "primera_cuota",
  "2da cuota": "segunda_cuota",
};

const METODO_PAGO_MAP: Record<string, string> = {
  binance: "binance",
  transferencia: "transferencia",
  "caja de ahorro usd": "caja_ahorro_usd",
  "caja ahorro usd": "caja_ahorro_usd",
  "link mp": "link_mp",
  mercadopago: "link_mp",
  "mercado pago": "link_mp",
  cash: "cash",
  efectivo: "cash",
  uruguayos: "uruguayos",
  "link stripe": "link_stripe",
  stripe: "link_stripe",
};

// ═══════════════════════════════════════════════════════
// MIGRATION FUNCTIONS
// ═══════════════════════════════════════════════════════

// ─── 1. Team Members ────────────────────────────────
async function migrateTeamMembers() {
  log("=== Migrating Team Members ===");
  const records = await fetchAllRecords("tblRxMpUKOhfkF0ys");

  // Fetch existing team_members to get their UUIDs
  const { data: existingMembers } = await supabase.from("team_members").select("id, nombre");

  const existingMap: Record<string, string> = {};
  for (const m of existingMembers || []) {
    existingMap[m.nombre.toLowerCase()] = m.id;
  }

  for (const record of records) {
    const f = record.fields;
    const nombre = (f["Nombre"] as string) || "";
    const airtableId = record.id;

    // Map to existing seeded team_member if name matches
    const existingId = existingMap[nombre.toLowerCase()];

    if (existingId) {
      const foto_url = await migrateAttachment(
        f["Adjunta foto de Perfil"] as Array<{ url: string; filename: string; type: string }>,
        "avatars",
        "team"
      );

      await supabase
        .from("team_members")
        .update({
          etiqueta: f["Etiqueta"] || null,
          rol: f["Rol/ Cargo"] || null,
          email: f["Mail"] || null,
          telefono: f["Contacto"] || null,
          fecha_nacimiento: f["Fecha de Nacimiento"] || null,
          foto_url: foto_url || undefined,
          observaciones: f["Observaciones "] || null,
        })
        .eq("id", existingId);

      idMap[airtableId] = existingId;

      // Build collaborator mapping
      const collab = f["Clsoers"] as { name?: string; email?: string; id?: string } | undefined;
      if (collab) {
        teamMap[(collab.name || "").toLowerCase()] = existingId;
        teamMap[(collab.email || "").toLowerCase()] = existingId;
        teamMap[(collab.id || "").toLowerCase()] = existingId;
      }
      teamMap[nombre.toLowerCase()] = existingId;

      log(`  Updated team member: ${nombre} (${existingId})`);
    } else {
      const newId = randomUUID();
      const foto_url = await migrateAttachment(
        f["Adjunta foto de Perfil"] as Array<{ url: string; filename: string; type: string }>,
        "avatars",
        "team"
      );

      await supabase.from("team_members").insert({
        id: newId,
        nombre,
        etiqueta: f["Etiqueta"] || null,
        rol: f["Rol/ Cargo"] || null,
        email: f["Mail"] || null,
        telefono: f["Contacto"] || null,
        fecha_nacimiento: f["Fecha de Nacimiento"] || null,
        foto_url,
        observaciones: f["Observaciones "] || null,
        activo: true,
      });

      idMap[airtableId] = newId;
      teamMap[nombre.toLowerCase()] = newId;
      log(`  Created team member: ${nombre} (${newId})`);
    }
  }
  log(`Team members done. Mapped ${Object.keys(teamMap).length} collaborator entries.`);
}

// ─── 2. Leads + Payments (from Reporte de Llamadas) ─
async function migrateLeadsAndPayments() {
  log("=== Migrating Leads + Payments (Reporte de Llamadas) ===");
  const records = await fetchAllRecords("tbleCytRILP3D7Q3N");
  log(`  Total records to migrate: ${records.length}`);

  const leadRows: Record<string, unknown>[] = [];
  const paymentRows: Record<string, unknown>[] = [];

  for (const record of records) {
    const f = record.fields;
    const leadId = randomUUID();
    idMap[record.id] = leadId;

    const setterId = resolveRecordLink(f["\uD83D\uDE4E\u200D\u2642\uFE0F Setter"]);
    const closerId = resolveCollaborator(f["\uD83D\uDC64 Closer"]);
    const cobradorId = resolveCollaborator(f["\uD83D\uDC64 Cobro de Cuotas"]);

    const estadoRaw = ((f["\uD83D\uDCCC Estado de la Llamada"] as string) || "").toLowerCase();
    const estado = ESTADO_LLAMADA_MAP[estadoRaw] || "pendiente";

    const fuenteRaw = ((f["\uD83D\uDE80 Funte del lead"] as string) || "").toLowerCase();
    const fuente = FUENTE_MAP[fuenteRaw] || null;

    const programaRaw = ((f["\uD83C\uDFC6 Programa Pitcheado"] as string) || "").toLowerCase();
    const programa = PROGRAMA_MAP[programaRaw] || null;

    const conceptoRaw = ((f["Concepto "] as string) || (f["Concepto"] as string) || "").toLowerCase();
    const concepto = CONCEPTO_MAP[conceptoRaw] || null;

    const planPagoRaw = ((f["\uD83E\uDDFE Plan de Pago (Venta)"] as string) || "").toLowerCase();
    const planPago = PLAN_PAGO_MAP[planPagoRaw] || null;

    const calificadoRaw = ((f["\uD83D\uDCCCLead Calificado?"] as string) || "").toLowerCase();
    const calificadoMap: Record<string, string> = {
      calificado: "calificado",
      "no calificado": "no_calificado",
      podria: "podria",
    };

    const lead: Record<string, unknown> = {
      id: leadId,
      airtable_id: record.id,
      nombre: f["\uD83D\uDC64 Nombre del Lead"] || null,
      email: f["\uD83D\uDCE7 Email"] || null,
      telefono: f["\uD83D\uDCDE Tel\u00e9fono"] || null,
      instagram: f["\uD83D\uDCF2 Instagram"] || null,
      fuente,
      utm_source: f["\uD83D\uDD17 UTM Source"] || null,
      utm_medium: f["\uD83D\uDD17 UTM Medium"] || null,
      utm_content: f["\uD83D\uDD17 UTM Content"] || null,
      evento_calendly: f["\uD83C\uDFDB\uFE0F Evento"] || null,
      calendly_event_id: f["ID Calendly"] || null,
      fecha_agendado: f["\uD83D\uDCC6 Fecha de Agendado"] || null,
      fecha_llamada: f["\uD83D\uDCC6 Fecha de Llamada"] || null,
      estado,
      setter_id: setterId,
      closer_id: closerId,
      cobrador_id: cobradorId,
      contexto_setter: f["\uD83D\uDCD1 Contexto Setter"] || null,
      reporte_general: f["\uD83D\uDCAC Reporte General"] || null,
      experiencia_ecommerce: f["\u00bfQu\u00e9 tanta experiencia tenes haciendo ecommerce?"] || null,
      seguridad_inversion:
        f[
          "\u00bfQu\u00e9 tan seguro te sent\u00eds de que podamos ayudarte a resolver los problemas que hoy frenan tu crecimiento o el de tu ecommerce?"
        ] || null,
      tipo_productos: f["\u00bfQu\u00e9 tipo de productos vendes y/o qu\u00e9 te gustar\u00eda arrancar a vender?"] || null,
      compromiso_asistencia:
        f[
          "\u00bfTe comprometes a asistir a tiempo y sin distracciones a la sesi\u00f3n? Trabajamos \u00fanicamente con personas comprometidas."
        ] || null,
      dispuesto_invertir:
        f["\u00bfEstas dispuestos a invertir entre 1500 a 3000 usd en tu crecimiento profesional y personal?"] || null,
      decisor:
        f[
          "En caso de comenzar a trabajar con nosotros \u00bfExiste alguien m\u00e1s que deba estar presente para tomar la decisi\u00f3n de hacerlo?"
        ] || null,
      lead_calificado: calificadoMap[calificadoRaw] || null,
      link_llamada: f["\uD83D\uDD17 Link de Llamada"] || null,
      programa_pitcheado: programa,
      concepto,
      plan_pago: planPago,
      ticket_total: f["\uD83D\uDCB0 Ticket Total"] || null,
      fue_seguimiento: f["\uD83D\uDD01 Fue Seguimiento?"] || false,
      de_donde_viene_lead: f["De donde viene el lead"] || null,
    };

    leadRows.push(lead);

    // ─── Normalize 3 embedded payments into separate rows ───
    const paymentConfigs = [
      {
        num: 1,
        monto: f["\uD83D\uDCB0 Pago 1"] as number,
        montoArs: f["arr de \uD83D\uDCB0 Pago 1"] as number,
        fecha: f["\uD83D\uDCC6 Fecha de Pago 1"] as string,
        estado: f["\uD83D\uDCCA Estado 1"] as string,
        comprobante: f["Comprobante Ingreso"] || f["Comprobante de pago 1"],
      },
      {
        num: 2,
        monto: f["\uD83D\uDCB0 Pago 2"] as number,
        fecha: f["\uD83D\uDCC6 Fecha de Pago 2"] as string,
        estado: f["\uD83D\uDCCA Estado 2"] as string,
        comprobante: f["Comprobante cuota 2"],
      },
      {
        num: 3,
        monto: f["\uD83D\uDCB0 Pago 3"] as number,
        fecha: f["\uD83D\uDCC6 Fecha de Pago 3"] as string,
        estado: f["\uD83D\uDCCA Estado 3"] as string,
        comprobante: f["Comprobante cuota 3"],
      },
    ];

    for (const pc of paymentConfigs) {
      if (!pc.monto && !pc.fecha) continue;

      const paymentEstadoRaw = ((pc.estado as string) || "").toLowerCase();
      const paymentEstado = PAYMENT_ESTADO_MAP[paymentEstadoRaw] || "pendiente";

      const comprobante_url = await migrateAttachment(
        pc.comprobante as Array<{ url: string; filename: string; type: string }>,
        "comprobantes",
        `leads/${leadId}`
      );

      const metodoPagoRaw = (
        (f["Metodo de pago "] as string) ||
        (f["Metodos de pago"] as string) ||
        ""
      ).toLowerCase();
      const metodoPago = METODO_PAGO_MAP[metodoPagoRaw] || null;

      const receptorRaw = f["Recibe"] as string[];
      const receptor = receptorRaw && receptorRaw.length > 0 ? receptorRaw[0] : null;

      paymentRows.push({
        id: randomUUID(),
        lead_id: leadId,
        client_id: null,
        numero_cuota: pc.num,
        monto_usd: pc.monto || 0,
        monto_ars: pc.num === 1 ? ((f["\uD83D\uDCB0 PESOS"] as number) || 0) : 0,
        fecha_pago: pc.fecha || null,
        fecha_vencimiento: null,
        estado: paymentEstado,
        metodo_pago: metodoPago,
        receptor,
        comprobante_url,
        cobrador_id: cobradorId,
        verificado: (f["verif cash"] as boolean) || false,
        es_renovacion: false,
        renewal_id: null,
      });
    }
  }

  await upsertBatch("leads", leadRows);
  log(`  Migrated ${leadRows.length} leads`);

  // Payments don't have airtable_id, upsert by id
  await upsertBatch("payments", paymentRows, "id");
  log(`  Created ${paymentRows.length} payment records from normalized leads`);
}

// ─── 3. Clients (from Base de Clientes) ─────────────
async function migrateClients() {
  log("=== Migrating Clients (Base de Clientes) ===");
  const records = await fetchAllRecords("tbloD4rZPAyBKoylS");

  const clientRows: Record<string, unknown>[] = [];

  for (const record of records) {
    const f = record.fields;
    const clientId = randomUUID();
    idMap[record.id] = clientId;

    const leadId = resolveRecordLink(f["this one"]) || resolveRecordLink(f["\uD83D\uDE4D\u200D\u2642\uFE0FCliente"]);

    const programaRaw = ((f["\uD83D\uDE80 Programa"] as string) || "").toLowerCase();
    const programa = PROGRAMA_MAP[programaRaw] || null;

    const estadoRaw = ((f["\uD83D\uDCCA Estado"] as string) || "").toLowerCase();
    const estadoMap: Record<string, string> = {
      activo: "activo",
      pausado: "pausado",
      inactivo: "inactivo",
      "solo skool": "solo_skool",
      "no termino pagar": "no_termino_pagar",
    };
    const estado = estadoMap[estadoRaw] || "activo";

    const seguimientoEstadoRaw = ((f["Estado para seguimientos"] as string) || "").toLowerCase();
    const seguimientoMap: Record<string, string> = {
      "para seguimiento": "para_seguimiento",
      "no necesita": "no_necesita",
      "seguimiento urgente": "seguimiento_urgente",
    };

    const contactoEstadoRaw = ((f["Estado Contacto"] as string) || "").toLowerCase();
    const contactoMap: Record<string, string> = {
      "por contactar": "por_contactar",
      contactado: "contactado",
      "respondio renueva": "respondio_renueva",
      "respondio debe cuota": "respondio_debe_cuota",
      "es socio": "es_socio",
      "no renueva": "no_renueva",
      "no responde": "no_responde",
      "numero invalido": "numero_invalido",
      "retirar acceso": "retirar_acceso",
      verificar: "verificar",
    };

    const origenRaw = ((f["Origen"] as string) || "").toLowerCase();
    const origenMap: Record<string, string> = {
      "skool ig": "skool_ig",
      "solo skool": "solo_skool",
      "registro normal": "registro_normal",
      "grupo wa esa": "grupo_wa_esa",
      "grupo ig ecom": "grupo_ig_ecom",
    };

    const canalRaw = ((f["Canal Contacto"] as string) || "").toLowerCase();
    const canalMap: Record<string, string> = {
      whatsapp: "whatsapp",
      "instagram dm": "instagram_dm",
      "email skool": "email_skool",
      buscar: "buscar",
    };

    const prioridadRaw = ((f["Prioridad Contacto"] as string) || "").toLowerCase();
    const prioridadMap: Record<string, string> = {
      "a wa sin nombre": "a_wa_sin_nombre",
      "b ig solo username": "b_ig_solo_username",
      "c solo skool": "c_solo_skool",
      "d nombre parcial": "d_nombre_parcial",
    };

    const categoriaRaw = ((f["Categoria"] as string) || "").toLowerCase();
    const categoriaMap: Record<string, string> = {
      "activo ok": "activo_ok",
      "cuotas pendientes": "cuotas_pendientes",
      deudor: "deudor",
      "solo skool verificar": "solo_skool_verificar",
      "solo wa verificar": "solo_wa_verificar",
      "solo ig verificar": "solo_ig_verificar",
      "con pagos sin skool": "con_pagos_sin_skool",
      "por verificar": "por_verificar",
      "equipo lauty": "equipo_lauty",
    };

    const semanaEstadoMap: Record<string, string> = {
      "primeras publicaciones": "primeras_publicaciones",
      "primera venta": "primera_venta",
      "escalando anuncios": "escalando_anuncios",
    };

    const responsableRenovacion = resolveCollaborator(f["Responsable de Reno"]);

    clientRows.push({
      id: clientId,
      airtable_id: record.id,
      lead_id: leadId,
      nombre: f["\uD83D\uDE4E\u200D\u2642\uFE0F Nombre del Cliente"] || null,
      email: f["\uD83D\uDCE8 Email"] || null,
      telefono: f["\uD83D\uDCDE T\u00e9lefono"] || null,
      programa,
      estado,
      fecha_onboarding: f["\uD83D\uDCC6 Fecha de Onboarding"] || null,
      fecha_offboarding: f["\uD83D\uDCC6 Fecha de Offboarding"] || null,
      total_dias_programa: f["Total de D\u00edas"] || null,
      llamadas_base: f["Llamadas Base"] || null,
      pesadilla: f["\u00bfPesadilla?"] || false,
      exito: f["\u00bf\u00c9xito?"] || false,
      discord: f["Discord "] || false,
      skool: f["skool"] || false,
      win_discord: f["\u2705 Win en Discord"] || false,
      semana_1_estado: semanaEstadoMap[((f["Semana 1"] as string) || "").toLowerCase()] || null,
      semana_1_accionables: f["Accionables semana 1"] || null,
      semana_2_estado: semanaEstadoMap[((f["Semana 2"] as string) || "").toLowerCase()] || null,
      semana_2_accionables: f["Accionables semana 2"] || null,
      semana_3_estado: semanaEstadoMap[((f["Semana 3"] as string) || "").toLowerCase()] || null,
      semana_3_accionables: f["Accionables semana 3"] || null,
      semana_4_estado: semanaEstadoMap[((f["Semana 4"] as string) || "").toLowerCase()] || null,
      semana_4_accionables: f["Accionable Semana 4"] || null,
      facturacion_mes_1: f["Facturacion Mes 1"] || f["Facturacion dia 1"] || null,
      facturacion_mes_2: f["Facturacion Mes 2"] || null,
      facturacion_mes_3: f["Facturacion Mes 3"] || null,
      facturacion_mes_4: f["Facturacion Mes 4"] || null,
      estado_seguimiento: seguimientoMap[seguimientoEstadoRaw] || null,
      fecha_ultimo_seguimiento: f["Ultimo Seguimiento"] || null,
      fecha_proximo_seguimiento: f["Fecha de Proximo seguimiento"] || null,
      notas_conversacion: f["notas_conversacion"] || null,
      estado_contacto: contactoMap[contactoEstadoRaw] || null,
      responsable_renovacion: responsableRenovacion,
      origen: origenMap[origenRaw] || null,
      canal_contacto: canalMap[canalRaw] || null,
      prioridad_contacto: prioridadMap[prioridadRaw] || null,
      categoria: categoriaMap[categoriaRaw] || null,
      email_skool: f["Email Skool"] || null,
      en_wa_esa: f["En WA ESA"] || false,
      en_ig_grupo: f["En IG Grupo"] || false,
      deudor_usd: f["Deudor USD"] || null,
      deudor_vencimiento: f["Deudor Vencimiento"] || null,
    });
  }

  await upsertBatch("clients", clientRows);
  log(`  Migrated ${clientRows.length} clients`);
}

// ─── 4. Renewal History ─────────────────────────────
async function migrateRenewalHistory() {
  log("=== Migrating Renewal History ===");
  const records = await fetchAllRecords("tblDSzP54VuEfce8e");

  const rows: Record<string, unknown>[] = [];

  for (const record of records) {
    const f = record.fields;
    const renewalId = randomUUID();
    idMap[record.id] = renewalId;

    const clientId = resolveRecordLink(f["\uD83D\uDE4D\u200D\u2642\uFE0FCliente"]) || resolveRecordLink(f["\uD83D\uDC64 Cliente"]);

    const tipoRaw = ((f["Tipo de Renovacion"] as string) || "").toLowerCase();
    const tipoMap: Record<string, string> = {
      resell: "resell",
      "upsell vip": "upsell_vip",
      "upsell meli": "upsell_meli",
      "upsell vip cuotas": "upsell_vip_cuotas",
      "upsell meli cuotas": "upsell_meli_cuotas",
      "resell cuotas": "resell_cuotas",
    };

    const programaRaw = ((f["\uD83D\uDE80 Programa"] as string) || "").toLowerCase();
    const estadoRaw = ((f["\uD83D\uDCCA Estado"] as string) || "").toLowerCase();
    const estadoMap: Record<string, string> = {
      pago: "pago",
      "no renueva": "no_renueva",
      "cuota 1 pagada": "cuota_1_pagada",
      "cuota 2 pagada": "cuota_2_pagada",
    };

    const comprobante_url = await migrateAttachment(
      f["Comprobante renovacion"] as Array<{ url: string; filename: string; type: string }>,
      "comprobantes",
      `renewals/${renewalId}`
    );

    rows.push({
      id: renewalId,
      airtable_id: record.id,
      client_id: clientId,
      tipo_renovacion: tipoMap[tipoRaw] || null,
      programa_nuevo: PROGRAMA_MAP[programaRaw] || null,
      fecha_renovacion: f["\uD83D\uDCC6 Fecha en que pago la Renovaci\u00f3n"] || null,
      estado: estadoMap[estadoRaw] || null,
      comprobante_url,
    });
  }

  await upsertBatch("renewal_history", rows);
  log(`  Migrated ${rows.length} renewal history records`);
}

// ─── 5. Tracker Sessions ────────────────────────────
async function migrateTrackerSessions() {
  log("=== Migrating Tracker 1a1 ===");
  const records = await fetchAllRecords("tblln5DRvO6iZBdLa");

  const rows: Record<string, unknown>[] = [];

  for (const record of records) {
    const f = record.fields;
    const sessionId = randomUUID();
    idMap[record.id] = sessionId;

    const clientId = resolveRecordLink(f["Cliente"]);
    const assigneeId = resolveCollaborator(f["Assignee"]);

    const estadoRaw = ((f["Estado de la Sesi\u00f3n"] as string) || "").toLowerCase();
    const estadoMap: Record<string, string> = {
      programada: "programada",
      done: "done",
      "cancelada/no asisti\u00f3": "cancelada_no_asistio",
      "cancelada no asistio": "cancelada_no_asistio",
    };

    const sesionNumRaw = f["Qu\u00e9 n\u00famero de sesi\u00f3n 1 a 1 acab\u00e1s de tener?"] as string;
    const numero_sesion = sesionNumRaw ? parseInt(sesionNumRaw.replace(/\D/g, ""), 10) || null : null;

    rows.push({
      id: sessionId,
      airtable_id: record.id,
      client_id: clientId,
      fecha: f["ID / Fecha de Llamada"] || null,
      numero_sesion,
      estado: estadoMap[estadoRaw] || "programada",
      enlace_llamada: f["Enlace de la Llamada"] || null,
      assignee_id: assigneeId,
      notas_setup: f["Notas del Setup / Producto"] || null,
      pitch_upsell: f["Pitch de Upsell Realizado"] || false,
      rating:
        f[
          "Del 1 al 10, \u00bfqu\u00e9 tan \u00fatil fue la Ultima sesi\u00f3n  para destrabar tu negocio? (Escala lineal)"
        ] || null,
      aprendizaje_principal:
        f[
          "Cu\u00e1l fue tu mayor aprendizaje o la tarea principal que te llevaste de esta \u00faltima llamada?"
        ] || null,
      feedback_cliente:
        f[
          "Para seguir rompi\u00e9ndola: \u00bfQu\u00e9 te gustar\u00eda sumar, o en qu\u00e9 tema sent\u00eds que deber\u00edamos profundizar m\u00e1s en el programa?"
        ] || null,
      herramienta_mas_util: f["Que herramienta te sirvi\u00f3 mas?"] || null,
    });
  }

  await upsertBatch("tracker_sessions", rows);
  log(`  Migrated ${rows.length} tracker sessions`);
}

// ─── 6. Daily Reports ───────────────────────────────
async function migrateDailyReports() {
  log("=== Migrating Daily Reports ===");
  const records = await fetchAllRecords("tblpfZMziou1Ny9sU");

  const rows: Record<string, unknown>[] = [];

  for (const record of records) {
    const f = record.fields;
    const reportId = randomUUID();
    idMap[record.id] = reportId;

    const setterId = resolveRecordLink(f["Setter"]);

    rows.push({
      id: reportId,
      airtable_id: record.id,
      setter_id: setterId,
      fecha: f["Fecha del Reporte"] || null,
      conversaciones_iniciadas: f["Conversaciones Iniciadas"] || 0,
      respuestas_historias: f["Respuestas a Historias"] || 0,
      calendarios_enviados: f["Calendarios Enviados"] || 0,
      ventas_por_chat: f["Ventas cerradas por chat "] || null,
      conversaciones_lead_inicio: f["Conversaciones Iniciadas por el lead"] || null,
      agendas_confirmadas: f["Agendas Confirmadas"] || null,
      origen_principal:
        f["Orginen principal del dia (ej : Historias , CTA, Solicitudes de MSJ)"] || null,
    });
  }

  await upsertBatch("daily_reports", rows);
  log(`  Migrated ${rows.length} daily reports`);
}

// ─── 7. IG Metrics ──────────────────────────────────
async function migrateIGMetrics() {
  log("=== Migrating IG Metrics ===");
  const records = await fetchAllRecords("tbl17rny30qYztVo3");

  const rows: Record<string, unknown>[] = [];

  for (const record of records) {
    const f = record.fields;
    const metricId = randomUUID();
    idMap[record.id] = metricId;

    rows.push({
      id: metricId,
      airtable_id: record.id,
      periodo: f["\uD83D\uDCC6 Periodo"] || null,
      fecha_inicio: f["\uD83D\uDCC5 Fecha Inicio"] || null,
      fecha_fin: f["\uD83D\uDCC5 Fecha Fin"] || null,
      cuentas_alcanzadas: f["\uD83D\uDCE3 Cuentas Alcanzadas"] || null,
      impresiones: f["\uD83D\uDC41 Impresiones"] || null,
      visitas_perfil: f["\uD83D\uDC64 Visitas al Perfil"] || null,
      toques_enlaces: f["\uD83D\uDD17 Toques Enlaces"] || null,
      nuevos_seguidores: f["\uD83D\uDCC8 Nuevos Seguidores"] || null,
      unfollows: f["\uD83D\uDCC9 Unfollows"] || null,
      total_seguidores: f["\uD83D\uDC65 Total Seguidores"] || null,
      total_interacciones: f["\u2B50 Total Interacciones"] || null,
      reels_publicados: f["\uD83C\uDFAC Reels Publicados"] || null,
      interacciones_reels: f["\uD83C\uDFAC Interacciones Reels"] || null,
      likes_reels: f["\u2764\uFE0F Likes Reels"] || null,
      comentarios_reels: f["\uD83D\uDCAC Comentarios Reels"] || null,
      compartidos_reels: f["\uD83D\uDCE4 Compartidos Reels"] || null,
      guardados_reels: f["\uD83D\uDD16 Guardados Reels"] || null,
      leads_ig: f["\uD83D\uDCCA Leads IG (periodo)"] || null,
      ventas_ig: f["\uD83D\uDCCA Ventas IG (periodo)"] || null,
      cash_ig: f["\uD83D\uDCB0 Cash IG (periodo)"] || null,
    });
  }

  await upsertBatch("ig_metrics", rows);
  log(`  Migrated ${rows.length} IG metrics records`);
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
  logStream = fs.createWriteStream(LOG_FILE, { flags: "w" });

  log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  log("\u2551   Lauti CRM \u2014 Airtable \u2192 Supabase Migration \u2551");
  log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
  log(`Started at ${new Date().toISOString()}`);
  log("");

  try {
    // Order matters: team_members first (for collaborator mapping),
    // then leads (for payment normalization), then clients (needs lead IDs),
    // then everything else.

    await migrateTeamMembers();
    await migrateLeadsAndPayments();
    await migrateClients();
    await migrateRenewalHistory();
    await migrateTrackerSessions();
    await migrateDailyReports();
    await migrateIGMetrics();

    log("");
    log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    log("MIGRATION COMPLETE");
    log(`Total ID mappings: ${Object.keys(idMap).length}`);
    log(`Total team mappings: ${Object.keys(teamMap).length}`);
    log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  } catch (err) {
    logError("Migration failed", err);
    process.exit(1);
  } finally {
    logStream.end();
  }
}

main();
