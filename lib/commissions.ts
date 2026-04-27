/**
 * Commission scheme for Lauti CRM (vigente desde 2026-04-25):
 *
 * - Iván (closer puro, llamada):       10% flat sobre su cash mensual.
 * - Jorge (closer chat):               Tiered según su cash mensual.
 * - Joaquín (híbrido setter/closer):
 *     - Leads donde es setter Y closer (cerró él):  Tiered sobre su cash mensual de cierres propios.
 *     - Leads donde es solo setter (cerró otro):    5% fijo sobre cash de esos leads.
 * - Otros closers (no nombrados):     Por default, tiered (asumiendo chat).
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

    // Cash where this member is closer
    let cashAsCloser = 0;
    // Cash where this member is BOTH setter AND closer (for Joaquín tiered piece)
    let cashAsSelfClose = 0;
    // Cash where this member is ONLY setter (closer is someone else) — for setter 5% piece
    let cashAsSetterOnly = 0;

    for (const p of payments) {
      const l = leadById.get(p.lead_id);
      if (!l) continue;
      const isCloser = l.closer_id === t.id;
      const isSetter = l.setter_id === t.id;

      if (isCloser) {
        cashAsCloser += p.monto_usd;
        if (isSetter) cashAsSelfClose += p.monto_usd;
      } else if (isSetter) {
        cashAsSetterOnly += p.monto_usd;
      }
    }

    let comisionCloser = 0;
    let comisionSetter = 0;
    let tierAplicado = 0;

    if (tipo === "ivan") {
      // 10% flat sobre cash como closer
      comisionCloser = cashAsCloser * 0.10;
      tierAplicado = 0.10;
    } else if (tipo === "jorge") {
      tierAplicado = tierPct(cashAsCloser);
      comisionCloser = cashAsCloser * tierAplicado;
    } else if (tipo === "joaquin") {
      // tier sobre los que cerró él (setter+closer)
      tierAplicado = tierPct(cashAsSelfClose);
      comisionCloser = cashAsSelfClose * tierAplicado;
      // 5% fijo sobre los que solo settoeó
      comisionSetter = cashAsSetterOnly * SETTER_FLAT_PCT;
    } else {
      // Default: tiered como Jorge
      tierAplicado = tierPct(cashAsCloser);
      comisionCloser = cashAsCloser * tierAplicado;
    }

    const total = comisionCloser + comisionSetter;
    if (cashAsCloser === 0 && cashAsSelfClose === 0 && cashAsSetterOnly === 0) continue;

    results.push({
      team_member_id: t.id,
      nombre: t.nombre,
      closer_type: tipo,
      cash_collected: cashAsCloser + cashAsSetterOnly,
      tier_pct_aplicado: tierAplicado,
      comision_closer: Math.round(comisionCloser * 100) / 100,
      comision_setter: Math.round(comisionSetter * 100) / 100,
      comision_total: Math.round(total * 100) / 100,
      apto_bono: eligibleForBonus(cashAsCloser),
    });
  }

  return results.sort((a, b) => b.comision_total - a.comision_total);
}
