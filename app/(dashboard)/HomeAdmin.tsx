"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import KPICard from "@/app/components/KPICard";
import MonthSelector77 from "@/app/components/MonthSelector77";
import SaleBanner from "@/app/components/SaleBanner";
import { formatUSD, formatDate } from "@/lib/format";
import { getFiscalStart, getFiscalEnd, getFiscalMonth, parseLocalDate } from "@/lib/date-utils";
import { subMonths } from "date-fns";
import type { MonthlyCash, Payment, Client } from "@/lib/types";

interface Props {
  monthlyCash: MonthlyCash[];
  payments: Payment[];
  overduePayments: Payment[];
  atRiskClients: Client[];
}

export default function HomeAdmin({
  monthlyCash,
  payments,
  overduePayments,
  atRiskClients,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState(
    getFiscalStart().toISOString().split("T")[0]
  );

  const currentLabel = useMemo(() => {
    const d = parseLocalDate(selectedMonth);
    return getFiscalMonth(d);
  }, [selectedMonth]);

  const prevLabel = useMemo(() => {
    const d = parseLocalDate(selectedMonth);
    return getFiscalMonth(subMonths(d, 1));
  }, [selectedMonth]);

  const current = useMemo(
    () => monthlyCash.find((m) => m.mes_fiscal === currentLabel),
    [monthlyCash, currentLabel]
  );

  const prev = useMemo(
    () => monthlyCash.find((m) => m.mes_fiscal === prevLabel),
    [monthlyCash, prevLabel]
  );

  function delta(curr: number | undefined, previous: number | undefined): number | null {
    if (!curr || !previous || previous === 0) return null;
    return ((curr - previous) / previous) * 100;
  }

  const facturacion = current?.facturacion ?? 0;
  const cashTotal = current?.cash_total ?? 0;
  const cashVentasNuevas = current?.cash_ventas_nuevas ?? 0;
  const cashRenovaciones = current?.cash_renovaciones ?? 0;
  const cashCuotas = current?.cash_cuotas ?? 0;
  const ventasNuevasCount = current?.ventas_nuevas_count ?? 0;
  const renovacionesCount = current?.renovaciones_count ?? 0;
  const saldoPendiente = current?.saldo_pendiente_30d ?? 0;
  const ticketPromedio =
    ventasNuevasCount > 0 ? facturacion / ventasNuevasCount : 0;

  // Daily cumulative cash chart
  const dailyCashData = useMemo(() => {
    const start = parseLocalDate(selectedMonth);
    const end = getFiscalEnd(start);
    const fiscalPayments = payments.filter((p) => {
      if (!p.fecha_pago || p.estado !== "pagado") return false;
      const d = parseLocalDate(p.fecha_pago);
      return d >= start && d <= end;
    });

    const dailyMap: Record<string, number> = {};
    for (const p of fiscalPayments) {
      const day = p.fecha_pago!;
      dailyMap[day] = (dailyMap[day] || 0) + p.monto_usd;
    }

    const sortedDays = Object.keys(dailyMap).sort();
    let cumulative = 0;
    return sortedDays.map((day) => {
      cumulative += dailyMap[day];
      return {
        fecha: day,
        label: parseLocalDate(day).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "short",
        }),
        cash: cumulative,
      };
    });
  }, [payments, selectedMonth]);

  return (
    <div className="space-y-6">
      <SaleBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Resumen del periodo {currentLabel}
          </p>
        </div>
        <MonthSelector77 value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Facturaci\u00f3n"
          value={facturacion}
          format="usd"
          delta={delta(facturacion, prev?.facturacion)}
          icon={"\u{1F4C8}"}
        />
        <KPICard
          label="Cash Collected"
          value={cashTotal}
          format="usd"
          delta={delta(cashTotal, prev?.cash_total)}
          icon={"\u{1F4B0}"}
        />
        <KPICard
          label="Renovaciones"
          value={cashRenovaciones}
          format="usd"
          delta={delta(cashRenovaciones, prev?.cash_renovaciones)}
          icon={"\u{1F504}"}
        />
        <KPICard
          label="Cuotas"
          value={cashCuotas}
          format="usd"
          delta={delta(cashCuotas, prev?.cash_cuotas)}
          icon={"\u{1F4CB}"}
        />
        <KPICard
          label="Saldo Pendiente (30d)"
          value={saldoPendiente}
          format="usd"
          icon={"\u{23F3}"}
        />
        <KPICard
          label="Ventas Nuevas"
          value={ventasNuevasCount}
          format="number"
          delta={delta(ventasNuevasCount, prev?.ventas_nuevas_count)}
          icon={"\u{1F680}"}
        />
        <KPICard
          label="Ticket Promedio"
          value={ticketPromedio}
          format="usd"
          icon={"\u{1F3AF}"}
        />
      </div>

      {/* Cash Acumulado Chart */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Cash Collected Diario Acumulado
        </h2>
        {dailyCashData.length === 0 ? (
          <p className="text-[var(--muted)] text-sm py-8 text-center">
            Sin pagos en este periodo
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyCashData}>
              <defs>
                <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis
                dataKey="label"
                stroke="var(--muted)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="var(--muted)"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v: number) => formatUSD(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "8px",
                  color: "white",
                }}
                formatter={(value) => [formatUSD(Number(value)), "Cash acumulado"]}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="cash"
                stroke="var(--green)"
                strokeWidth={2}
                fill="url(#cashGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Alert Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cuotas Vencidas Hoy */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Cuotas Vencidas Hoy
            </h2>
            <span className="text-xs bg-[var(--red)]/15 text-[var(--red)] px-2 py-1 rounded-full font-medium">
              {overduePayments.length}
            </span>
          </div>
          {overduePayments.length === 0 ? (
            <p className="text-[var(--muted)] text-sm">
              No hay cuotas vencidas hoy
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {overduePayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-[var(--red)]/5 border border-[var(--red)]/10 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-white font-medium">
                      Cuota #{p.numero_cuota}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Lead: {p.lead_id?.slice(0, 8) ?? "\u2014"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[var(--red)]">
                    {formatUSD(p.monto_usd)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clientes en Riesgo */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Clientes en Riesgo
            </h2>
            <span className="text-xs bg-[var(--yellow)]/15 text-[var(--yellow)] px-2 py-1 rounded-full font-medium">
              {atRiskClients.length}
            </span>
          </div>
          {atRiskClients.length === 0 ? (
            <p className="text-[var(--muted)] text-sm">
              Sin clientes en riesgo
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {atRiskClients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-[var(--yellow)]/5 border border-[var(--yellow)]/10 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-white font-medium">{c.nombre}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {c.programa ?? "Sin programa"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[var(--yellow)]">
                    Score: {c.health_score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
