import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { computeCommissions } from "@/lib/commissions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SECRET = process.env.LAUTI_ADMIN_SECRET || "lauti-sync-2026";

/**
 * Solo calcula y persiste comisiones desde Supabase data (sin tocar Airtable).
 * Útil para testear el nuevo esquema sin esperar al sync completo.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("s") !== SECRET) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sb = createServerClient();

  // Fiscal month 7-7
  const today = new Date();
  let startMonth = today.getMonth();
  let startYear = today.getFullYear();
  if (today.getDate() < 7) {
    startMonth -= 1;
    if (startMonth < 0) { startMonth = 11; startYear -= 1; }
  }
  const start = new Date(startYear, startMonth, 7);
  const end = new Date(startYear, startMonth + 1, 6, 23, 59, 59);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  const { data: payments } = await sb
    .from("payments")
    .select("lead_id, monto_usd, fecha_pago, estado")
    .eq("estado", "pagado")
    .gte("fecha_pago", startStr)
    .lte("fecha_pago", endStr)
    .range(0, 9999);

  const { data: leads } = await sb
    .from("leads")
    .select("id, closer_id, setter_id")
    .range(0, 9999);

  const { data: team } = await sb
    .from("team_members")
    .select("id, nombre")
    .eq("activo", true);

  const filteredPays = (payments || [])
    .filter((p) => p.lead_id)
    .map((p) => ({ lead_id: p.lead_id as string, monto_usd: Number(p.monto_usd || 0) }));

  const results = computeCommissions({
    payments: filteredPays,
    leads: (leads || []) as Array<{ id: string; closer_id: string | null; setter_id: string | null }>,
    team: (team || []) as Array<{ id: string; nombre: string }>,
  });

  // Check if at_apto_bono column exists
  const { error: bonoCheck } = await sb.from("team_members").select("at_apto_bono").limit(1);
  const hasBonoCol = !bonoCheck;

  const dryRun = url.searchParams.get("dry") === "1";

  if (dryRun) {
    return NextResponse.json({
      fiscal_month: { from: startStr, to: endStr },
      payments_count: filteredPays.length,
      total_cash: filteredPays.reduce((s, p) => s + p.monto_usd, 0),
      has_bono_col: hasBonoCol,
      results,
    });
  }

  // Reset all
  const resetPatch: Record<string, unknown> = { at_comision_closer: 0, at_comision_setter: 0, at_comision_total: 0 };
  if (hasBonoCol) resetPatch.at_apto_bono = false;
  await sb
    .from("team_members")
    .update(resetPatch)
    .neq("id", "00000000-0000-0000-0000-000000000000");

  let updated = 0;
  for (const r of results) {
    const total = r.comision_closer + r.comision_setter;
    const updatePatch: Record<string, unknown> = {
      at_comision_closer: r.comision_closer,
      at_comision_setter: r.comision_setter,
      at_comision_total: total,
    };
    if (hasBonoCol) updatePatch.at_apto_bono = r.apto_bono;
    const { error } = await sb.from("team_members").update(updatePatch).eq("id", r.team_member_id);
    if (!error) updated++;
  }

  return NextResponse.json({
    ok: true,
    fiscal_month: { from: startStr, to: endStr },
    updated,
    results,
  });
}
