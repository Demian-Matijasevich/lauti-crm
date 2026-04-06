import { z } from "zod";

function safeString(maxLen = 500) {
  return z.string().max(maxLen).transform((s) => {
    const trimmed = s.trim();
    if (/^[=+\-@]/.test(trimmed)) return "'" + trimmed;
    return trimmed;
  });
}

export const loginSchema = z.object({
  nombre: z.string().min(1).max(50),
  pin: z.string().length(4).regex(/^\d{4}$/),
});

export const llamadaSchema = z.object({
  lead_id: z.string().uuid(),
  estado: safeString(50),
  programa_pitcheado: safeString(50).optional(),
  concepto: safeString(30).optional(),
  plan_pago: safeString(30).optional(),
  ticket_total: z.number().min(0).default(0),
  reporte_general: safeString(2000).optional(),
  notas_internas: safeString(2000).optional(),
  lead_calificado: safeString(20).optional(),
});

export const pagoSchema = z.object({
  lead_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  numero_cuota: z.number().int().min(1).max(10),
  monto_usd: z.number().min(0).default(0),
  monto_ars: z.number().min(0).default(0),
  fecha_pago: z.string(),
  estado: z.enum(["pendiente", "pagado", "perdido"]).default("pagado"),
  metodo_pago: safeString(30),
  receptor: safeString(50),
  es_renovacion: z.boolean().default(false),
});

export const ventaChatSchema = z.object({
  nombre: safeString(100),
  instagram: safeString(100).optional(),
  telefono: safeString(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  programa_pitcheado: safeString(50),
  ticket_total: z.number().min(0),
  plan_pago: safeString(30),
  monto_usd: z.number().min(0),
  metodo_pago: safeString(30),
  receptor: safeString(50),
  setter_id: z.string().uuid(),
});

export const reporteSetterSchema = z.object({
  setter_id: z.string().uuid(),
  fecha: z.string(),
  conversaciones_iniciadas: z.number().int().min(0).default(0),
  respuestas_historias: z.number().int().min(0).default(0),
  calendarios_enviados: z.number().int().min(0).default(0),
  ventas_por_chat: safeString(500).optional(),
  agendas_confirmadas: safeString(500).optional(),
  origen_principal: z.array(z.string()).default([]),
});

export const followUpSchema = z.object({
  client_id: z.string().uuid(),
  tipo: z.enum(["llamada", "whatsapp", "dm", "email", "presencial"]),
  notas: safeString(2000),
  proxima_accion: safeString(500).optional(),
  proxima_fecha: z.string().optional(),
});
