"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import KPICard from "@/app/components/KPICard";
import { formatUSD } from "@/lib/format";
import type { Payment, AtCommission } from "@/lib/types";

interface UrgentPayment {
  id: string;
  payment_id: string;
  nombre: string;
  telefono: string | null;
  instagram: string | null;
  monto_usd: number;
  fecha_vencimiento: string | null;
  dias_vencido: number;
  numero_cuota: number;
}

interface Props {
  cuotasPorCobrarHoy: { count: number; monto: number };
  cuotasCobradasMes: { count: number; monto: number };
  vencidasSinCobrar: { count: number; monto: number };
  melComision: AtCommission | null;
  urgentPayments: UrgentPayment[];
  weeklyPaid: { dia: string; label: string; monto: number }[];
}

export default function HomeMel({
  cuotasPorCobrarHoy,
  cuotasCobradasMes,
  vencidasSinCobrar,
  melComision,
  urgentPayments,
  weeklyPaid,
}: Props) {
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const comisionAcumulada = cuotasCobradasMes.monto * 0.1;
  const objetivo = melComision?.at_comision_cobranzas ?? comisionAcumulada;
  const comisionPct = objetivo > 0 ? Math.min((comisionAcumulada / objetivo) * 100, 100) : 0;

  const visibleUrgent = useMemo(
    () => urgentPayments.filter((p) => !dismissed.has(p.payment_id)).slice(0, 5),
    [urgentPayments, dismissed]
  );

  async function handleMarkPaid(paymentId: string) {
    setMarkingId(paymentId);
    try {
      // Redirect to cobranzas page with payment pre-selected for proper form
      window.location.href = `/cobranzas?mark=${paymentId}`;
    } catch {
      setMarkingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Hola Mel</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Tu resumen de cobranzas
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Por cobrar hoy"
          value={cuotasPorCobrarHoy.monto}
          format="usd"
          icon={"\uD83D\uDCC5"}
        />
        <KPICard
          label="Cobradas este mes"
          value={cuotasCobradasMes.monto}
          format="usd"
          icon={"\u2705"}
        />
        <KPICard
          label="Mi comision (10%)"
          value={comisionAcumulada}
          format="usd"
          icon={"\uD83D\uDCB8"}
        />
        <KPICard
          label="Vencidas sin cobrar"
          value={vencidasSinCobrar.monto}
          format="usd"
          icon={"\uD83D\uDEA8"}
          valueClassName="text-[var(--red)]"
        />
      </div>

      {/* Secondary counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{cuotasPorCobrarHoy.count}</p>
          <p className="text-xs text-[var(--muted)]">cuotas hoy</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{cuotasCobradasMes.count}</p>
          <p className="text-xs text-[var(--muted)]">cobradas este mes</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-[var(--red)]">{vencidasSinCobrar.count}</p>
          <p className="text-xs text-[var(--muted)]">vencidas</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-[var(--purple-light)]">{formatUSD(comisionAcumulada)}</p>
          <p className="text-xs text-[var(--muted)]">comision acum.</p>
        </div>
      </div>

      {/* Cola rapida */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Cola Urgente
          </h2>
          <span className="text-xs bg-[var(--red)]/15 text-[var(--red)] px-2 py-1 rounded-full font-medium">
            {urgentPayments.filter((p) => !dismissed.has(p.payment_id)).length} pendientes
          </span>
        </div>
        {visibleUrgent.length === 0 ? (
          <p className="text-[var(--muted)] text-sm py-4 text-center">
            Sin cuotas urgentes. Todo al dia!
          </p>
        ) : (
          <div className="space-y-3">
            {visibleUrgent.map((p) => (
              <div
                key={p.payment_id}
                className={`flex items-center justify-between gap-4 border rounded-lg px-4 py-3 ${
                  p.dias_vencido < 0
                    ? "bg-[var(--red)]/5 border-[var(--red)]/20"
                    : "bg-[var(--yellow)]/5 border-[var(--yellow)]/20"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      p.dias_vencido < 0
                        ? "bg-[var(--red)]/20 text-[var(--red)]"
                        : "bg-[var(--yellow)]/20 text-[var(--yellow)]"
                    }`}>
                      {p.dias_vencido < 0
                        ? `${Math.abs(p.dias_vencido)}d vencida`
                        : p.dias_vencido === 0
                        ? "Hoy"
                        : `en ${p.dias_vencido}d`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted)]">
                    <span>Cuota #{p.numero_cuota}</span>
                    <span className="font-semibold text-white">{formatUSD(p.monto_usd)}</span>
                    {p.telefono && (
                      <a
                        href={`https://wa.me/${p.telefono.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--green)] hover:underline"
                      >
                        {p.telefono}
                      </a>
                    )}
                    {p.instagram && (
                      <a
                        href={`https://instagram.com/${p.instagram.replace("@", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--purple-light)] hover:underline"
                      >
                        @{p.instagram.replace("@", "")}
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleMarkPaid(p.payment_id)}
                  disabled={markingId === p.payment_id}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium bg-[var(--green)]/15 text-[var(--green)] border border-[var(--green)]/30 rounded-lg hover:bg-[var(--green)]/25 transition-colors disabled:opacity-50"
                >
                  {markingId === p.payment_id ? "..." : "Marcar pagado"}
                </button>
              </div>
            ))}
          </div>
        )}
        {urgentPayments.filter((p) => !dismissed.has(p.payment_id)).length > 5 && (
          <a
            href="/cobranzas"
            className="block mt-3 text-center text-sm text-[var(--purple-light)] hover:underline"
          >
            Ver todas las cuotas pendientes
          </a>
        )}
      </div>

      {/* Mi Comision progress */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Mi Comision</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--muted)]">
            {formatUSD(comisionAcumulada)} cobrado de {formatUSD(objetivo)} objetivo
          </span>
          <span className="text-sm font-bold text-[var(--purple-light)]">
            {comisionPct.toFixed(0)}%
          </span>
        </div>
        <div className="w-full h-4 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--purple)] to-[var(--green)] transition-all duration-500 rounded-full"
            style={{ width: `${comisionPct}%` }}
          />
        </div>
        {melComision && (
          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div>
              <p className="text-lg font-bold text-white">{formatUSD(melComision.at_comision_closer)}</p>
              <p className="text-xs text-[var(--muted)]">Closer</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{formatUSD(melComision.at_comision_cobranzas)}</p>
              <p className="text-xs text-[var(--muted)]">Cobranzas</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--green)]">{formatUSD(melComision.at_comision_total)}</p>
              <p className="text-xs text-[var(--muted)]">Total</p>
            </div>
          </div>
        )}
      </div>

      {/* Resumen Semanal */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Cobrado esta semana
        </h2>
        {weeklyPaid.length === 0 ? (
          <p className="text-[var(--muted)] text-sm py-4 text-center">
            Sin cobros esta semana
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyPaid}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
              <XAxis
                dataKey="label"
                stroke="var(--muted)"
                fontSize={12}
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
                formatter={(value) => [formatUSD(Number(value)), "Cobrado"]}
              />
              <Bar dataKey="monto" fill="var(--green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
