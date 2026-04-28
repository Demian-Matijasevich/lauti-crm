import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const SECRET = process.env.LAUTI_ADMIN_SECRET || "lauti-sync-2026";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("s") !== SECRET) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sb = createServerClient();
  const { data: team } = await sb
    .from("team_members")
    .select("id, nombre, rol, activo, at_comision_closer, at_comision_setter, at_comision_cobranzas, at_comision_total, at_apto_bono")
    .order("at_comision_total", { ascending: false });

  const { data: leadsCount } = await sb.from("leads").select("id", { count: "exact", head: true });
  const { data: paysAll } = await sb.from("payments").select("id", { count: "exact", head: true });
  const { data: paysApril } = await sb
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pagado")
    .gte("fecha_pago", "2026-04-07")
    .lte("fecha_pago", "2026-05-06");

  // Count leads with closer_id / setter_id set
  const { count: withCloser } = await sb.from("leads").select("id", { count: "exact", head: true }).not("closer_id", "is", null);
  const { count: withSetter } = await sb.from("leads").select("id", { count: "exact", head: true }).not("setter_id", "is", null);

  return NextResponse.json({
    team_count: (team || []).length,
    team_with_commissions: team || [],
    leads_total: (leadsCount as unknown as { count: number })?.count ?? null,
    payments_total: (paysAll as unknown as { count: number })?.count ?? null,
    payments_in_april_fiscal: (paysApril as unknown as { count: number })?.count ?? null,
    leads_with_closer_id: withCloser,
    leads_with_setter_id: withSetter,
  });
}
