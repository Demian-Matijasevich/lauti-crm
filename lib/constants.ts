// Commission scheme (vigente 2026-04-25). Para detalle ver lib/commissions.ts.
// - Iván (llamada):  10% flat
// - Jorge (chat):    Tiered 5/7,5/10% (ver tierPct)
// - Joaquín:         Tiered si setter+closer; 5% fijo si solo setter
// - Mel cobranzas:   10% sobre cash de cuotas que ella cobra
export const COMMISSION_CLOSER_FALLBACK = 0.10;     // Iván / closer puro llamada
export const COMMISSION_SETTER_FLAT = 0.05;          // Joaquín cuando es solo setter
export const COMMISSION_COBRANZAS = 0.10;            // Mel
// Tier percentages (cash mensual del closer)
export const TIER_BASE = 0.05;                       // ≤ $100k
export const TIER_MID = 0.075;                       // $100k–$150k
export const TIER_TOP = 0.10;                        // $150k+
export const TIER_BREAKPOINT_1 = 100000;
export const TIER_BREAKPOINT_2 = 150000;
export const BONUS_THRESHOLD = 200000;

// Mantengo aliases viejos para no romper imports existentes (deprecated)
export const COMMISSION_CLOSER = COMMISSION_CLOSER_FALLBACK;
export const COMMISSION_SETTER = COMMISSION_SETTER_FLAT;

export const PROGRAM_DURATION_DAYS = 90;

export const PROGRAMS: Record<string, { label: string; precio: number }> = {
  mentoria_1k_pyf: { label: "Mentoría 1K PYF", precio: 1000 },
  mentoria_2_5k_pyf: { label: "Mentoría 2.5K PYF", precio: 2500 },
  mentoria_2_8k_pyf: { label: "Mentoría 2.8K PYF", precio: 2800 },
  mentoria_5k: { label: "Mentoría 5K", precio: 5000 },
  skool: { label: "Skool", precio: 0 },
  vip_5k: { label: "VIP 5K", precio: 5000 },
  mentoria_2_5k_cuotas: { label: "Mentoría 2.5K Cuotas", precio: 2500 },
  mentoria_5k_cuotas: { label: "Mentoría 5K Cuotas", precio: 5000 },
  mentoria_1k_cuotas: { label: "Mentoría 1K Cuotas", precio: 1000 },
  mentoria_fee: { label: "Mentoría Fee", precio: 0 },
  cuota_vip_mantencion: { label: "Cuota VIP Mantención", precio: 0 },
};

export const RECEPTORES = [
  "JUANMA", "Cuenta pesos Lauti", "Cuenta dolares Lauti",
  "Efectivo", "Binance lauti", "Stripe",
  "Financiera Payments", "Becheq",
];

export const LEAD_ESTADOS_LABELS: Record<string, string> = {
  pendiente: "⏳ Pendiente",
  no_show: "👤 No-Show",
  cancelada: "🚨 Cancelada",
  reprogramada: "🕒 Re-programada",
  seguimiento: "🔄 Seguimiento",
  no_calificado: "🚫 No Calificado",
  no_cierre: "⚠️ No Cierre",
  reserva: "💰 Reserva",
  cerrado: "🚀 Cerrado",
  adentro_seguimiento: "🔄 Adentro en Seguimiento",
  broke_cancelado: "❌ Broke/Cancelado",
};

export const CLIENT_ESTADOS_LABELS: Record<string, string> = {
  activo: "✅ Activo",
  pausado: "⏸️ Pausado",
  inactivo: "❌ Inactivo",
  solo_skool: "📚 Solo Skool",
  no_termino_pagar: "💸 No Terminó de Pagar",
};
