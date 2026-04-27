/**
 * Commission scheme for Lauti CRM (vigente desde 2026-04-25, refinado 2026-04-27):
 *
 * SETTER (siempre, sin importar quién cierre):
 *   - 5% flat sobre cash de leads donde fue setter.
 *
 * CLOSER:
 *   - Iván (llamada):           10% flat sobre cash de leads donde fue closer.
 *   - Jorge/Joaquín (chat):     Tiered 5/7,5/10% según su cash mensual de cierres propios.
 *   - Otros (default):          Tiered como chat.
 *
 * Comisión total = setter + closer (puede sumar ambos roles si la misma persona setteo y cerró).
 *
 * Tiers (sobre el cash mensual del closer):
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
    let tierAplicado = 0;

    if (cashAsCloser > 0) {
      if (tipo === "ivan") {
        comisionCloser = cashAsCloser * 0.10;
        tierAplicado = 0.10;
      } else {
        // jorge / joaquin / otros (chat)
        tierAplicado = tierPct(cashAsCloser);
        comisionCloser = cashAsCloser * tierAplicado;
      }
    }

    // Setter 5% flat sobre TODO lo que setteó (sin importar quién cierre)
    const comisionSetter = cashAsSetter * SETTER_FLAT_PCT;

    const total = comisionCloser + comisionSetter;
    if (cashAsCloser === 0 && cashAsSetter === 0) continue;

    results.push({
      team_member_id: t.id,
      nombre: t.nombre,
      closer_type: tipo,
      cash_collected: cashAsCloser + cashAsSetter,
      tier_pct_aplicado: tierAplicado,
      comision_closer: Math.round(comisionCloser * 100) / 100,
      comision_setter: Math.round(comisionSetter * 100) / 100,
      comision_total: Math.round(total * 100) / 100,
      apto_bono: eligibleForBonus(cashAsCloser),
    });
  }

  return results.sort((a, b) => b.comision_total - a.comision_total);
}
