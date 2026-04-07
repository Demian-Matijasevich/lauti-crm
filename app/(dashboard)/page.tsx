import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase-server";
import { getFiscalStart, getFiscalEnd, getFiscalMonth } from "@/lib/date-utils";
import HomeAdmin from "./HomeAdmin";
import HomeCloser from "./HomeCloser";
import HomeSetter from "./HomeSetter";
import type { MonthlyCash, Payment, Client, Lead, CloserKPI, Commission, AtCommission, RenewalQueueRow } from "@/lib/types";

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

    const [cashRes, paymentsRes, overdueRes, atRiskRes, commissionsRes, leadsAtRes, atCommRes, pendingPaymentsRes, pipelineLeadsRes, renewalQueueRes] = await Promise.all([
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
      supabase.from("leads").select("at_cash_7_7,at_cash_cuotas_7_7,ticket_total").gt("at_cash_7_7", 0),
      supabase.from("team_members")
        .select("id,nombre,at_comision_closer,at_comision_setter,at_comision_cobranzas,at_comision_total")
        .gt("at_comision_total", 0),
      // Revenue prediction: pending payments in fiscal period
      supabase
        .from("payments")
        .select("monto_usd")
        .eq("estado", "pendiente")
        .gte("fecha_vencimiento", fiscalStart.toISOString().split("T")[0])
        .lte("fecha_vencimiento", fiscalEnd.toISOString().split("T")[0]),
      // Revenue prediction: pipeline leads
      supabase
        .from("leads")
        .select("id, nombre, ticket_total, estado")
        .in("estado", ["pendiente", "seguimiento", "reserva"]),
      // Revenue prediction: renewal queue
      supabase
        .from("v_renewal_queue")
        .select("*")
        .in("semaforo", ["urgente", "proximo"]),
    ]);

    // Calculate Airtable totals for current period
    const leadsAt = (leadsAtRes.data ?? []) as { at_cash_7_7: number; at_cash_cuotas_7_7: number; ticket_total: number }[];
    const atCashTotal = leadsAt.reduce((s, l) => s + (l.at_cash_7_7 || 0), 0);
    const atCuotasTotal = leadsAt.reduce((s, l) => s + (l.at_cash_cuotas_7_7 || 0), 0);

    // Revenue prediction calculations
    const pendingPaymentsTotal = (pendingPaymentsRes.data ?? []).reduce((s: number, p: { monto_usd: number }) => s + p.monto_usd, 0);
    const pipelineLeads = (pipelineLeadsRes.data ?? []) as Pick<Lead, "id" | "nombre" | "ticket_total" | "estado">[];
    const pipelineTotal = pipelineLeads.reduce((s, l) => s + (l.ticket_total || 0), 0);
    const renewalQueue = (renewalQueueRes.data ?? []) as RenewalQueueRow[];

    return (
      <HomeAdmin
        monthlyCash={(cashRes.data as MonthlyCash[]) ?? []}
        payments={(paymentsRes.data as Payment[]) ?? []}
        overduePayments={(overdueRes.data as Payment[]) ?? []}
        atRiskClients={(atRiskRes.data as Client[]) ?? []}
        commissions={(commissionsRes.data as Commission[]) ?? []}
        atCommissions={(atCommRes.data as AtCommission[]) ?? []}
        atCashCollected={atCashTotal}
        atCuotas={atCuotasTotal}
        revPrediction={{
          cashCollected: atCashTotal,
          cuotasPendientes: pendingPaymentsTotal,
          pipelineTotal,
          pipelineCount: pipelineLeads.length,
          renewalCount: renewalQueue.length,
          renewalAvgValue: 1500, // Average renewal value estimate
        }}
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
