/**
 * Commission scheme for Lauti CRM (vigente desde 2026-04-27):
 *
 * - Iván (closer puro, llamada):    10% flat sobre cash de leads donde fue closer.
 * - Jorge / Joaquín (chat closers): Tiered 5/7,5/10% sobre cash de leads donde fueron SETTER
 *                                   (no importa quién cierre — si setteó, cobra). Reciben todo
 *                                   por la columna setter; no se paga closer adicional.
 * - Otros: Tiered como chat (default).
 * - Mel: cobranzas 10% (manejado fuera de este helper).
 *
 * Tiers (sobre el cash mensual donde fueron setter, para chat — o donde cerraron, para llamada):
 *   ≤ $100k       → 5%
 *   $100k–$150k   → 7,5%
 *   $150k–$200k   → 10%
 *   > $200k       → 10% + flag bono
 */

export const SETTER_FLAT_PCT = 0.05;

export function tierPct(cashMensual: number): number {
  if (cashMensual <= 100000) return 0.05;
  if (cashMensual <= 150000) return 0.075;
  return 0.10;
}

export function eligibleForBonus(cashMensual: number): boolean {
  return cashMensual > 200000;
}

export type CloserType = "ivan" | "jorge" | "joaquin" | "otro";

// Resolve closer type by name (case-insensitive substring match)
export function classifyCloser(nombre: string): CloserType {
  const n = nombre.toLowerCase().trim();
  if (n.includes("iván") || n.includes("ivan")) return "ivan";
  if (n.includes("jorge")) return "jorge";
  if (n.includes("joaquín") || n.includes("joaquin")) return "joaquin";
  return "otro";
}

interface PaymentLite {
  monto_usd: number;
  lead_id: string;
}

interface LeadLite {
  id: string;
  closer_id: string | null;
  setter_id: string | null;
}

interface TeamLite {
  id: string;
  nombre: string;
}

export interface CommissionResult {
  team_member_id: string;
  nombre: string;
  closer_type: CloserType;
  cash_collected: number;
  tier_pct_aplicado: number;
  comision_closer: number;
  comision_setter: number;
  comision_total: number;
  apto_bono: boolean;
}

/**
 * Compute commissions for all team members in a given period.
 * - payments: filtrados ya por la ventana de tiempo deseada (mes 7-7).
 * - leads: TODOS los leads (para resolver closer_id/setter_id de cada payment).
 * - team: lista de team_members.
 */
export function computeCommissions(args: {
  payments: PaymentLite[];
  leads: LeadLite[];
  team: TeamLite[];
}): CommissionResult[] {
  const { payments, leads, team } = args;

  const leadById = new Map<string, LeadLite>();
  for (const l of leads) leadById.set(l.id, l);

  const results: CommissionResult[] = [];

  for (const t of team) {
    const tipo = classifyCloser(t.nombre);

    // Cash en TODOS los leads donde fue setter (no importa quien cierre)
    let cashAsSetter = 0;
    // Cash en leads donde fue closer
    let cashAsCloser = 0;

    for (const p of payments) {
      const l = leadById.get(p.lead_id);
      if (!l) continue;
      if (l.setter_id === t.id) cashAsSetter += p.monto_usd;
      if (l.closer_id === t.id) cashAsCloser += p.monto_usd;
    }

    let comisionCloser = 0;
    let comisionSetter = 0;
    let tierAplicado = 0;
    let cashRelevante = 0; // para tier + bono

    if (tipo === "ivan") {
      // 10% flat sobre cierres
      comisionCloser = cashAsCloser * 0.10;
      tierAplicado = 0.10;
      cashRelevante = cashAsCloser;
    } else {
      // Jorge / Joaquín / chat: tiered sobre lo que setteó (cubre tanto self-close como leads que cierra otro)
      tierAplicado = tierPct(cashAsSetter);
      comisionSetter = cashAsSetter * tierAplicado;
      cashRelevante = cashAsSetter;
    }

    const total = comisionCloser + comisionSetter;
    if (cashAsCloser === 0 && cashAsSetter === 0) continue;

    results.push({
      team_member_id: t.id,
      nombre: t.nombre,
      closer_type: tipo,
      cash_collected: cashRelevante,
      tier_pct_aplicado: tierAplicado,
      comision_closer: Math.round(comisionCloser * 100) / 100,
      comision_setter: Math.round(comisionSetter * 100) / 100,
      comision_total: Math.round(total * 100) / 100,
      apto_bono: eligibleForBonus(cashRelevante),
    });
  }

  return results.sort((a, b) => b.comision_total - a.comision_total);
}
