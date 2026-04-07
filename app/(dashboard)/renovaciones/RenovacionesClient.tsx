"use client";

import { useState, useMemo } from "react";
import type { AuthSession, RenewalQueueRow } from "@/lib/types";

interface RenewalHistoryItem {
  id: string;
  client_id: string;
  tipo_renovacion: string | null;
  programa_anterior: string | null;
  programa_nuevo: string | null;
  monto_total: number;
  plan_pago: string | null;
  estado: string | null;
  fecha_renovacion: string | null;
  client?: { id: string; nombre: string; programa: string | null };
  responsable?: { id: string; nombre: string };
}

interface Metrics {
  tasaRenovacion: number;
  revenuePromedio: number;
  churnRate: number;
  totalRevenue: number;
  renewedCount: number;
  expiredCount: number;
}

interface Props {
  renewalQueue: RenewalQueueRow[];
  renewalHistory: RenewalHistoryItem[];
  metrics: Metrics;
  session: AuthSession;
}

type Tab = "queue" | "historial";

export default function RenovacionesClient({
  renewalQueue,
  renewalHistory,
  metrics,
  session,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("queue");
  const [search, setSearch] = useState("");
  const [filterSemaforo, setFilterSemaforo] = useState<string>("todos");
  const [showRenewalForm, setShowRenewalForm] = useState<string | null>(null);

  const filteredQueue = useMemo(() => {
    let items = [...renewalQueue];
    if (filterSemaforo !== "todos") {
      items = items.filter((i) => i.semaforo === filterSemaforo);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      items = items.filter((i) => i.nombre.toLowerCase().includes(s));
    }
    return items;
  }, [renewalQueue, filterSemaforo, search]);

  function getPredictionBadge(item: RenewalQueueRow) {
    if (item.health_score >= 70) {
      return (
        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full font-medium">
          Alta probabilidad
        </span>
      );
    }
    if (item.health_score < 50) {
      return (
        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-medium">
          Riesgo churn
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 bg-gray-500/20 text-gray-300 rounded-full font-medium">
        Media
      </span>
    );
  }

  function getSemaforoEmoji(s: string) {
    if (s === "vencido") return "\u{1F534}";
    if (s === "urgente") return "\u{1F7E1}";
    if (s === "proximo") return "\u{1F7E0}";
    return "\u{1F7E2}";
  }

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-sm text-gray-400">Tasa de renovacion</p>
          <p className="text-2xl font-bold text-green-400">
            {metrics.tasaRenovacion}%
          </p>
          <p className="text-xs text-gray-500">
            {metrics.renewedCount}/{metrics.expiredCount} clientes
          </p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-sm text-gray-400">Revenue por renovacion</p>
          <p className="text-2xl font-bold text-white">
            ${metrics.revenuePromedio.toLocaleString()}
          </p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-sm text-gray-400">Revenue total renovaciones</p>
          <p className="text-2xl font-bold text-blue-400">
            ${metrics.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-sm text-gray-400">Churn rate</p>
          <p className="text-2xl font-bold text-red-400">
            {metrics.churnRate}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--card-border)]">
        <button
          onClick={() => setActiveTab("queue")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "queue"
              ? "border-blue-400 text-blue-400"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Cola de renovaciones ({renewalQueue.length})
        </button>
        <button
          onClick={() => setActiveTab("historial")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "historial"
              ? "border-blue-400 text-blue-400"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Historial ({renewalHistory.length})
        </button>
      </div>

      {activeTab === "queue" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-white w-64 placeholder-gray-500"
            />
            <select
              value={filterSemaforo}
              onChange={(e) => setFilterSemaforo(e.target.value)}
              className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="todos">Todos</option>
              <option value="vencido">Vencidos</option>
              <option value="urgente">Urgentes</option>
              <option value="proximo">Proximos</option>
              <option value="ok">Al dia</option>
            </select>
          </div>

          {/* Queue Table */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-400">Estado</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Cliente</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Programa</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Vencimiento</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Dias</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Health</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Prediccion</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Contacto</th>
                    <th className="px-4 py-3 font-medium text-gray-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {filteredQueue.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-white/5 ${
                        item.semaforo === "vencido" ? "bg-red-500/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {getSemaforoEmoji(item.semaforo)}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{item.nombre}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {item.programa}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {item.fecha_vencimiento
                          ? new Date(item.fecha_vencimiento).toLocaleDateString(
                              "es-AR"
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium ${
                            item.dias_restantes < 0
                              ? "text-red-600"
                              : item.dias_restantes <= 7
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}
                        >
                          {item.dias_restantes < 0
                            ? `${Math.abs(item.dias_restantes)}d vencido`
                            : `${item.dias_restantes}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-bold ${
                            item.health_score >= 80
                              ? "text-green-600"
                              : item.health_score >= 50
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {item.health_score}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getPredictionBadge(item)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {item.estado_contacto}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            setShowRenewalForm(
                              showRenewalForm === item.id ? null : item.id
                            )
                          }
                          className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          Registrar renovacion
                        </button>
                        {showRenewalForm === item.id && (
                          <RenewalForm
                            clientId={item.id}
                            clientNombre={item.nombre}
                            programaActual={item.programa}
                            sessionMemberId={session.team_member_id}
                            onSuccess={() => {
                              setShowRenewalForm(null);
                              window.location.reload();
                            }}
                            onCancel={() => setShowRenewalForm(null)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredQueue.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        No hay renovaciones en cola
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "historial" && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-400">Fecha</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Cliente</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Tipo</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Anterior</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Nuevo</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Monto</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Plan</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Estado</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {renewalHistory.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-400">
                      {r.fecha_renovacion
                        ? new Date(r.fecha_renovacion).toLocaleDateString("es-AR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {r.client?.nombre ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.tipo_renovacion ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {r.programa_anterior ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.programa_nuevo ?? "-"}</td>
                    <td className="px-4 py-3 font-medium text-white">
                      ${(r.monto_total ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {r.plan_pago ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.estado === "pago"
                            ? "bg-green-500/20 text-green-400"
                            : r.estado === "no_renueva"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {r.estado ?? "pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {r.responsable?.nombre ?? "-"}
                    </td>
                  </tr>
                ))}
                {renewalHistory.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-gray-500"
                    >
                      Sin historial de renovaciones
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// RenewalForm -- register a new renewal
// ========================================
function RenewalForm({
  clientId,
  clientNombre,
  programaActual,
  sessionMemberId,
  onSuccess,
  onCancel,
}: {
  clientId: string;
  clientNombre: string;
  programaActual: string;
  sessionMemberId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState("resell");
  const [programaNuevo, setProgramaNuevo] = useState(programaActual);
  const [monto, setMonto] = useState(0);
  const [planPago, setPlanPago] = useState("paid_in_full");
  const [metodo, setMetodo] = useState("binance");
  const [receptor, setReceptor] = useState("JUANMA");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create renewal_history record
      const renewalRes = await fetch("/api/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          tipo_renovacion: tipo,
          programa_anterior: programaActual,
          programa_nuevo: programaNuevo,
          monto_total: monto,
          plan_pago: planPago,
          estado: planPago === "paid_in_full" ? "pago" : "cuota_1_pagada",
          fecha_renovacion: new Date().toISOString().split("T")[0],
          responsable_id: sessionMemberId,
        }),
      });

      if (!renewalRes.ok) throw new Error("Error al crear renovacion");
      const renewal = await renewalRes.json();

      // 2. Create payment record
      const paymentRes = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          renewal_id: renewal.id,
          numero_cuota: 1,
          monto_usd: planPago === "paid_in_full" ? monto : Math.ceil(monto / 2),
          monto_ars: 0,
          fecha_pago: new Date().toISOString().split("T")[0],
          fecha_vencimiento: new Date().toISOString().split("T")[0],
          estado: "pagado",
          metodo_pago: metodo,
          receptor,
          es_renovacion: true,
        }),
      });

      if (paymentRes.ok) {
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-3"
    >
      <p className="text-sm font-medium text-white">
        Renovacion para {clientNombre}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded px-2 py-1 text-sm text-white"
        >
          <option value="resell">Resell</option>
          <option value="upsell_vip">Upsell VIP</option>
          <option value="upsell_meli">Upsell Meli</option>
          <option value="upsell_vip_cuotas">Upsell VIP Cuotas</option>
          <option value="upsell_meli_cuotas">Upsell Meli Cuotas</option>
          <option value="resell_cuotas">Resell Cuotas</option>
        </select>
        <select
          value={programaNuevo}
          onChange={(e) => setProgramaNuevo(e.target.value)}
          className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded px-2 py-1 text-sm text-white"
        >
          <option value="mentoria_1k_pyf">Mentoria 1K PYF</option>
          <option value="mentoria_2_5k_pyf">Mentoria 2.5K PYF</option>
          <option value="mentoria_2_8k_pyf">Mentoria 2.8K PYF</option>
          <option value="mentoria_5k">Mentoria 5K</option>
          <option value="vip_5k">VIP 5K</option>
          <option value="mentoria_2_5k_cuotas">Mentoria 2.5K Cuotas</option>
          <option value="mentoria_5k_cuotas">Mentoria 5K Cuotas</option>
          <option value="mentoria_1k_cuotas">Mentoria 1K Cuotas</option>
          <option value="mentoria_fee">Mentoria Fee</option>
          <option value="cuota_vip_mantencion">Cuota VIP Mantencion</option>
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(Number(e.target.value))}
          className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded px-2 py-1 text-sm text-white"
          placeholder="Monto USD"
        />
        <select
          value={planPago}
          onChange={(e) => setPlanPago(e.target.value)}
          className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded px-2 py-1 text-sm text-white"
        >
          <option value="paid_in_full">Paid in Full</option>
          <option value="2_cuotas">2 Cuotas</option>
        </select>
        <select
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded px-2 py-1 text-sm text-white"
        >
          <option value="binance">Binance</option>
          <option value="transferencia">Transferencia</option>
          <option value="caja_ahorro_usd">Caja ahorro USD</option>
          <option value="link_mp">Link MP</option>
          <option value="cash">Cash</option>
          <option value="uruguayos">Uruguayos</option>
          <option value="link_stripe">Link Stripe</option>
        </select>
      </div>
      <select
        value={receptor}
        onChange={(e) => setReceptor(e.target.value)}
        className="border rounded px-2 py-1 text-sm w-full"
      >
        <option value="JUANMA">JUANMA</option>
        <option value="Cuenta pesos Lauti">Cuenta pesos Lauti</option>
        <option value="Cuenta dolares Lauti">Cuenta dolares Lauti</option>
        <option value="Efectivo">Efectivo</option>
        <option value="Binance lauti">Binance lauti</option>
        <option value="Stripe">Stripe</option>
        <option value="Financiera Payments">Financiera Payments</option>
        <option value="Becheq">Becheq</option>
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || monto <= 0}
          className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Registrar renovacion"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
