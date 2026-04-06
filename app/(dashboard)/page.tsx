import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase-server";
import { getFiscalStart, getFiscalEnd, getFiscalMonth } from "@/lib/date-utils";
import HomeAdmin from "./HomeAdmin";
import HomeCloser from "./HomeCloser";
import HomeSetter from "./HomeSetter";
import type { MonthlyCash, Payment, Client, Lead, CloserKPI, Commission } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createServerClient();

  if (session.is_admin) {
    // Fetch admin data
    const fiscalStart = getFiscalStart();
    const fiscalEnd = getFiscalEnd();
    const today = new Date().toISOString().split("T")[0];

    const [cashRes, paymentsRes, overdueRes, atRiskRes, commissionsRes] = await Promise.all([
      supabase.from("v_monthly_cash").select("*"),
      supabase
        .from("payments")
        .select("*")
        .eq("estado", "pagado")
        .gte("fecha_pago", fiscalStart.toISOString().split("T")[0])
        .lte("fecha_pago", fiscalEnd.toISOString().split("T")[0]),
      supabase
        .from("payments")
        .select("*")
        .eq("estado", "pendiente")
        .lte("fecha_vencimiento", today),
      supabase
        .from("clients")
        .select("*")
        .eq("estado", "activo")
        .lt("health_score", 50),
      supabase.from("v_commissions").select("*"),
    ]);

    return (
      <HomeAdmin
        monthlyCash={(cashRes.data as MonthlyCash[]) ?? []}
        payments={(paymentsRes.data as Payment[]) ?? []}
        overduePayments={(overdueRes.data as Payment[]) ?? []}
        atRiskClients={(atRiskRes.data as Client[]) ?? []}
        commissions={(commissionsRes.data as Commission[]) ?? []}
      />
    );
  }

  // Determine primary role
  const roles = session.roles;
  const isCloser = roles.includes("closer");
  const isSetter = roles.includes("setter");

  if (isCloser) {
    const [leadsRes, kpisRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*, closer:team_members!leads_closer_id_fkey(*), setter:team_members!leads_setter_id_fkey(*)")
        .eq("closer_id", session.team_member_id),
      supabase
        .from("v_closer_kpis")
        .select("*")
        .eq("mes_fiscal", getFiscalMonth(new Date())),
    ]);

    return (
      <HomeCloser
        leads={(leadsRes.data as Lead[]) ?? []}
        closerKpis={(kpisRes.data as CloserKPI[]) ?? []}
        currentMemberId={session.team_member_id}
        currentName={session.nombre}
      />
    );
  }

  if (isSetter) {
    const [reportsRes, leadsRes] = await Promise.all([
      supabase
        .from("daily_reports")
        .select("*")
        .eq("setter_id", session.team_member_id)
        .order("fecha", { ascending: false })
        .limit(30),
      supabase
        .from("leads")
        .select("*")
        .eq("setter_id", session.team_member_id)
        .eq("estado", "cerrado"),
    ]);

    return (
      <HomeSetter
        reports={reportsRes.data ?? []}
        leads={(leadsRes.data as Lead[]) ?? []}
        currentMemberId={session.team_member_id}
        currentName={session.nombre}
      />
    );
  }

  // Fallback — seguimiento or cobranzas roles redirect to their specific pages
  redirect("/clientes");
}
