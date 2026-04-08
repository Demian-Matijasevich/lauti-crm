import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase-server";
import { getFiscalStart, getFiscalEnd, getFiscalMonth, getToday, toDateString } from "@/lib/date-utils";
import type { ObjectiveData } from "./HomeCloser";
import HomeAdmin from "./HomeAdmin";
import HomeCloser from "./HomeCloser";
import HomeSetter from "./HomeSetter";
import HomeMel from "./HomeMel";
import type { MonthlyCash, Payment, Client, Lead, CloserKPI, Commission, AtCommission, RenewalQueueRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createServerClient();

  // Mel: admin + cobranzas — specialized collections dashboard
  const isMel = session.can_see_agent && session.roles.includes("cobranzas");
  if (isMel) {
    const supabaseMel = createServerClient();
    const now = getToday();
    const today = toDateString(now);
    const fiscalStart = getFiscalStart();
    const fiscalEnd = getFiscalEnd();
    const fiscalStartStr = toDateString(fiscalStart);
    const fiscalEndStr = toDateString(fiscalEnd);

    // Week boundaries (Mon-Sun)
    const dayOfWeek = now.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysSinceMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mondayStr = toDateString(monday);
    const sundayStr = toDateString(sunday);

    const [dueToday, paidThisMonth, overdueRes, melMemberRes, weeklyPaidRes] = await Promise.all([
      // Cuotas due today
      supabaseMel
        .from("payments")
        .select("id, monto_usd")
        .eq("estado", "pendiente")
        .eq("fecha_vencimiento", today),
      // Paid this fiscal month (by anyone — Mel sees all)
      supabaseMel
        .from("payments")
        .select("id, monto_usd, fecha_pago")
        .eq("estado", "pagado")
        .gte("fecha_pago", fiscalStartStr)
        .lte("fecha_pago", fiscalEndStr),
      // Overdue without payment
      supabaseMel
        .from("payments")
        .select(`
          id, monto_usd, fecha_vencimiento, numero_cuota,
          client:clients(id, nombre, telefono, instagram),
          lead:leads(id, nombre, telefono, instagram)
        `)
        .eq("estado", "pendiente")
        .lte("fecha_vencimiento", today)
        .order("fecha_vencimiento", { ascending: true }),
      // Mel's team_member record for commission
      supabaseMel
        .from("team_members")
        .select("id, nombre, at_comision_closer, at_comision_setter, at_comision_cobranzas, at_comision_total")
        .eq("id", session.team_member_id)
        .single(),
      // Paid this week for weekly chart
      supabaseMel
        .from("payments")
        .select("monto_usd, fecha_pago")
        .eq("estado", "pagado")
        .gte("fecha_pago", mondayStr)
        .lte("fecha_pago", sundayStr),
    ]);

    const dueTodayData = dueToday.data ?? [];
    const paidData = paidThisMonth.data ?? [];
    const overdueData = (overdueRes.data ?? []) as any[];

    // Build urgent payments list (due today + overdue)
    const urgentPayments = overdueData.map((p: any) => {
      const venc = p.fecha_vencimiento ? new Date(p.fecha_vencimiento + "T00:00:00") : getToday();
      const todayDate = getToday();
      todayDate.setHours(0, 0, 0, 0);
      const diasDiff = Math.floor((venc.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: p.id,
        payment_id: p.id,
        nombre: p.client?.nombre ?? p.lead?.nombre ?? "Sin nombre",
        telefono: p.client?.telefono ?? p.lead?.telefono ?? null,
        instagram: p.client?.instagram ?? p.lead?.instagram ?? null,
        monto_usd: p.monto_usd ?? 0,
        fecha_vencimiento: p.fecha_vencimiento,
        dias_vencido: diasDiff,
        numero_cuota: p.numero_cuota ?? 1,
      };
    });

    // Weekly paid chart data
    const dayNames = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
    const weeklyMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weeklyMap[d.toISOString().split("T")[0]] = 0;
    }
    for (const p of (weeklyPaidRes.data ?? []) as { monto_usd: number; fecha_pago: string }[]) {
      if (p.fecha_pago && weeklyMap[p.fecha_pago] !== undefined) {
        weeklyMap[p.fecha_pago] += p.monto_usd;
      }
    }
    const weeklyPaid = Object.entries(weeklyMap).map(([dia, monto], i) => ({
      dia,
      label: dayNames[i] ?? dia,
      monto,
    }));

    const melComision = melMemberRes.data
      ? {
          id: melMemberRes.data.id,
          nombre: melMemberRes.data.nombre,
          at_comision_closer: melMemberRes.data.at_comision_closer ?? 0,
          at_comision_setter: melMemberRes.data.at_comision_setter ?? 0,
          at_comision_cobranzas: melMemberRes.data.at_comision_cobranzas ?? 0,
          at_comision_total: melMemberRes.data.at_comision_total ?? 0,
        }
      : null;

    return (
      <HomeMel
        cuotasPorCobrarHoy={{
          count: dueTodayData.length,
          monto: dueTodayData.reduce((s: number, p: any) => s + (p.monto_usd ?? 0), 0),
        }}
        cuotasCobradasMes={{
          count: paidData.length,
          monto: paidData.reduce((s: number, p: any) => s + (p.monto_usd ?? 0), 0),
        }}
        vencidasSinCobrar={{
          count: overdueData.length,
          monto: overdueData.reduce((s: number, p: any) => s + (p.monto_usd ?? 0), 0),
        }}
        melComision={melComision}
        urgentPayments={urgentPayments}
        weeklyPaid={weeklyPaid}
      />
    );
  }

  if (session.is_admin) {
    // Fetch admin data
    const fiscalStart = getFiscalStart();
    const fiscalEnd = getFiscalEnd();
    const today = toDateString(getToday());

    const [cashRes, paymentsRes, overdueRes, atRiskRes, commissionsRes, leadsAtRes, atCommRes, pendingPaymentsRes, pipelineLeadsRes, renewalQueueRes] = await Promise.all([
      supabase.from("v_monthly_cash").select("*"),
      // Fetch ALL paid payments (not just current fiscal) so the chart works for any selected month
      supabase
        .from("payments")
        .select("*")
        .eq("estado", "pagado"),
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
        .gte("fecha_vencimiento", toDateString(fiscalStart))
        .lte("fecha_vencimiento", toDateString(fiscalEnd)),
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
    const currentFiscalMonth = getFiscalMonth(getToday());
    const [leadsRes, kpisRes, objRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*, closer:team_members!leads_closer_id_fkey(*), setter:team_members!leads_setter_id_fkey(*)")
        .eq("closer_id", session.team_member_id),
      supabase
        .from("v_closer_kpis")
        .select("*")
        .eq("mes_fiscal", currentFiscalMonth),
      supabase
        .from("objectives")
        .select("*")
        .eq("team_member_id", session.team_member_id)
        .eq("mes_fiscal", currentFiscalMonth)
        .maybeSingle(),
    ]);

    return (
      <HomeCloser
        leads={(leadsRes.data as Lead[]) ?? []}
        closerKpis={(kpisRes.data as CloserKPI[]) ?? []}
        currentMemberId={session.team_member_id}
        currentName={session.nombre}
        objective={(objRes.data as ObjectiveData) ?? null}
      />
    );
  }

  if (isSetter) {
    const currentFiscalMonth = getFiscalMonth(getToday());
    const [reportsRes, leadsRes, objRes] = await Promise.all([
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
      supabase
        .from("objectives")
        .select("*")
        .eq("team_member_id", session.team_member_id)
        .eq("mes_fiscal", currentFiscalMonth)
        .maybeSingle(),
    ]);

    return (
      <HomeSetter
        reports={reportsRes.data ?? []}
        leads={(leadsRes.data as Lead[]) ?? []}
        currentMemberId={session.team_member_id}
        currentName={session.nombre}
        objective={(objRes.data as ObjectiveData) ?? null}
      />
    );
  }

  // Fallback — seguimiento or cobranzas roles redirect to their specific pages
  redirect("/clientes");
}
