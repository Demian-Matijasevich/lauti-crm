"use client";

import { useState, useMemo } from "react";
import type { AuthSession, AgentTask } from "@/lib/types";
import type { CobranzasQueueItem } from "@/lib/queries/cobranzas";

interface Props {
  initialQueue: CobranzasQueueItem[];
  fiscalItems: CobranzasQueueItem[];
  fiscalPaid: { total: number; count: number };
  totalPorCobrar: number;
  fiscalStart: string;
  fiscalEnd: string;
  allTasks: AgentTask[];
  session: AuthSession;
}

type FilterTipo = "todos" | "cuotas" | "renovaciones" | "deudores";
type FilterSemaforo = "todos" | "vencido" | "urgente" | "proximo";

interface WeekBucket {
  label: string;
  start: Date;
  end: Date;
  items: CobranzasQueueItem[];
  total: number;
}

function getWeekBuckets(fiscalStart: string, fiscalEnd: string, items: CobranzasQueueItem[]): WeekBucket[] {
  const start = new Date(fiscalStart + "T00:00:00");
  const end = new Date(fiscalEnd + "T00:00:00");

  const weeks: WeekBucket[] = [];
  let weekStart = new Date(start);
  let weekNum = 1;

  while (weekStart <= end) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > end) weekEnd.setTime(end.getTime());

    const sLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
    const eLabel = `${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;

    const wStart = new Date(weekStart);
    const wEnd = new Date(weekEnd);

    const weekItems = items.filter((item) => {
      if (!item.fecha_vencimiento) return false;
      const d = new Date(item.fecha_vencimiento + "T00:00:00");
      return d >= wStart && d <= wEnd;
    });

    weeks.push({
      label: `Semana ${weekNum} (${sLabel} - ${eLabel})`,
      start: wStart,
      end: wEnd,
      items: weekItems,
      total: weekItems.reduce((sum, i) => sum + i.monto_usd, 0),
    });

    weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() + 1);
    weekNum++;
  }

  return weeks;
}

export default function CobranzasClient({
  initialQueue,
  fiscalItems,
  fiscalPaid,
  totalPorCobrar,
  fiscalStart,
  fiscalEnd,
  allTasks,
  session,
}: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [filterTipo, setFilterTipo] = useState<FilterTipo>("todos");
  const [filterSemaforo, setFilterSemaforo] = useState<FilterSemaforo>("todos");
  const [search, setSearch] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  const canSeeAgent = session.can_see_agent;

  const filtered = useMemo(() => {
    let items = [...queue];

    if (filterTipo === "cuotas") {
      items = items.filter(
        (i) => i.tipo === "cuota" || i.task_tipo === "cobrar_cuota"
      );
    } else if (filterTipo === "renovaciones") {
      items = items.filter(
        (i) => i.tipo === "renovacion" || i.task_tipo === "renovacion"
      );
    } else if (filterTipo === "deudores") {
      items = items.filter(
        (i) => i.semaforo === "vencido" && i.tipo === "cuota"
      );
    }

    if (filterSemaforo !== "todos") {
      items = items.filter((i) => i.semaforo === filterSemaforo);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      items = items.filter((i) =>
        i.client_nombre.toLowerCase().includes(s)
      );
    }

    return items;
  }, [queue, filterTipo, filterSemaforo, search]);

  // --- KPI Summary ---
  const totalVencidas = fiscalItems.filter((i) => i.semaforo === "vencido").length;
  const montoVencido = fiscalItems
    .filter((i) => i.semaforo === "vencido")
    .reduce((sum, i) => sum + i.monto_usd, 0);

  const cobradoTotal = fiscalPaid.total;
  const grandTotal = totalPorCobrar + cobradoTotal;
  const tasaCobro = grandTotal > 0 ? (cobradoTotal / grandTotal) * 100 : 0;

  // Weekly breakdown
  const weeks = useMemo(
    () => getWeekBuckets(fiscalStart, fiscalEnd, fiscalItems),
    [fiscalStart, fiscalEnd, fiscalItems]
  );

  function toggleWeek(idx: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function getSemaforoColor(s: string) {
    if (s === "vencido") return "text-[var(--red)]";
    if (s === "urgente") return "text-[var(--yellow)]";
    if (s === "proximo") return "text-orange-400";
    return "text-[var(--green)]";
  }

  function getSemaforoBg(s: string) {
    if (s === "vencido") return "bg-red-500/10";
    if (s === "urgente") return "bg-yellow-500/10";
    return "";
  }

  function getSemaforoDot(s: string) {
    if (s === "vencido") return "bg-[var(--red)]";
    if (s === "urgente") return "bg-[var(--yellow)]";
    if (s === "proximo") return "bg-orange-400";
    return "bg-[var(--green)]";
  }

  function getTipoLabel(item: CobranzasQueueItem) {
    if (item.tipo === "cuota")
      return `Cuota #${item.numero_cuota ?? "?"}`;
    if (item.tipo === "renovacion") return "Renovacion";
    if (item.task_tipo) {
      const labels: Record<string, string> = {
        cobrar_cuota: "Cobrar cuota",
        renovacion: "Renovacion",
        seguimiento: "Seguimiento",
        oportunidad_upsell: "Oportunidad upsell",
        bienvenida: "Bienvenida",
        seguimiento_urgente: "Seguimiento urgente",
        confirmar_pago: "Confirmar pago",
      };
      return labels[item.task_tipo] ?? item.task_tipo;
    }
    return item.tipo;
  }

  function getDiasLabel(dias: number) {
    if (dias < 0) return `${Math.abs(dias)}d vencida`;
    if (dias === 0) return "Vence hoy";
    return `${dias}d restantes`;
  }

  // --- Actions ---
  async function handleMarkContactado(item: CobranzasQueueItem) {
    setActiveAction(item.id);
    try {
      const res = await fetch(`/api/agent-tasks/${item.task_id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "in_progress" }),
      });
      if (res.ok) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, task_estado: "in_progress", estado_contacto: "contactado" }
              : q
          )
        );
      }
    } finally {
      setActiveAction(null);
    }
  }

  async function handleEscalar(item: CobranzasQueueItem) {
    if (!item.task_id) return;
    setActiveAction(item.id);
    try {
      const res = await fetch(`/api/agent-tasks/${item.task_id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prioridad: 1 }),
      });
      if (res.ok) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, task_prioridad: 1 } : q
          )
        );
      }
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards - Dark Theme */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--muted)] uppercase font-medium">Por cobrar este mes</p>
          <p className="text-2xl font-bold text-white">${totalPorCobrar.toLocaleString()}</p>
          <p className="text-xs text-[var(--muted)] mt-1">{fiscalItems.length} cuotas pendientes</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--muted)] uppercase font-medium">Cobrado este mes</p>
          <p className="text-2xl font-bold text-[var(--green)]">${cobradoTotal.toLocaleString()}</p>
          <p className="text-xs text-[var(--muted)] mt-1">{fiscalPaid.count} pagos recibidos</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--muted)] uppercase font-medium">Vencidas</p>
          <p className="text-2xl font-bold text-[var(--red)]">{totalVencidas}</p>
          <p className="text-xs text-[var(--red)]/70 mt-1">${montoVencido.toLocaleString()} USD</p>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--muted)] uppercase font-medium">Tasa de cobro</p>
          <p className="text-2xl font-bold text-[var(--purple-light)]">{tasaCobro.toFixed(1)}%</p>
          <div className="mt-2 bg-[var(--card-border)] rounded-full h-1.5">
            <div
              className="bg-[var(--purple)] h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(tasaCobro, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Weekly Breakdown */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Desglose semanal</h2>
        <div className="space-y-2">
          {weeks.map((week, idx) => {
            const isExpanded = expandedWeeks.has(idx);
            const weekVencidas = week.items.filter((i) => i.semaforo === "vencido").length;
            return (
              <div key={idx}>
                <button
                  onClick={() => toggleWeek(idx)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--purple)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--muted)] text-sm">{isExpanded ? "▾" : "▸"}</span>
                    <span className="text-sm font-medium text-white">{week.label}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {week.items.length} cuota{week.items.length !== 1 ? "s" : ""}
                    </span>
                    {weekVencidas > 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-[var(--red)] rounded">
                        {weekVencidas} vencida{weekVencidas !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white">${week.total.toLocaleString()}</span>
                </button>
                {isExpanded && week.items.length > 0 && (
                  <div className="mt-1 ml-6 space-y-1">
                    {week.items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-2 rounded-lg text-sm ${getSemaforoBg(item.semaforo)}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getSemaforoDot(item.semaforo)}`} />
                          <span className="text-white font-medium">{item.client_nombre}</span>
                          <span className="text-xs text-[var(--muted)]">{getTipoLabel(item)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs ${getSemaforoColor(item.semaforo)}`}>
                            {getDiasLabel(item.dias_vencido)}
                          </span>
                          <span className="text-white font-medium">
                            ${item.monto_usd.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isExpanded && week.items.length === 0 && (
                  <p className="mt-1 ml-6 text-xs text-[var(--muted)] py-2">
                    Sin cuotas en esta semana
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Tasks Dashboard */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Panel de Tareas</h2>
          {session.is_admin && (
            <button
              onClick={async () => {
                const res = await fetch("/api/agent-tasks/generate", {
                  method: "POST",
                });
                if (res.ok) {
                  const data = await res.json();
                  alert(
                    `Tareas generadas: ${data.created} creadas, ${data.skipped} duplicadas`
                  );
                  window.location.reload();
                }
              }}
              className="text-xs px-3 py-1.5 bg-[var(--purple)] text-white rounded-lg hover:bg-[var(--purple-dark)]"
            >
              Generar tareas
            </button>
          )}
        </div>

        {/* Task stats by status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              {
                label: "Pendientes",
                count: allTasks.filter((t) => t.estado === "pending").length,
                color: "text-[var(--yellow)]",
                bgColor: "bg-yellow-500/10",
              },
              {
                label: "En progreso",
                count: allTasks.filter((t) => t.estado === "in_progress").length,
                color: "text-blue-400",
                bgColor: "bg-blue-500/10",
              },
              {
                label: "Completadas",
                count: allTasks.filter((t) => t.estado === "done").length,
                color: "text-[var(--green)]",
                bgColor: "bg-green-500/10",
              },
              {
                label: "Fallidas",
                count: allTasks.filter((t) => t.estado === "failed").length,
                color: "text-[var(--red)]",
                bgColor: "bg-red-500/10",
              },
            ] as const
          ).map((stat) => (
            <div
              key={stat.label}
              className={`rounded-lg p-3 ${stat.bgColor}`}
            >
              <p className={`text-xs font-medium ${stat.color}`}>{stat.label}</p>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.count}</p>
            </div>
          ))}
        </div>

        {/* Tasks by type */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(
            [
              { tipo: "cobrar_cuota", label: "Cobrar cuota" },
              { tipo: "renovacion", label: "Renovacion" },
              { tipo: "seguimiento", label: "Seguimiento" },
              { tipo: "oportunidad_upsell", label: "Upsell" },
              { tipo: "bienvenida", label: "Bienvenida" },
              { tipo: "seguimiento_urgente", label: "Urgente" },
              { tipo: "confirmar_pago", label: "Confirmar pago" },
            ] as const
          ).map((t) => {
            const count = allTasks.filter(
              (task) => task.tipo === t.tipo
            ).length;
            const active = allTasks.filter(
              (task) =>
                task.tipo === t.tipo &&
                (task.estado === "pending" || task.estado === "in_progress")
            ).length;
            return (
              <div
                key={t.tipo}
                className="text-xs border border-[var(--card-border)] rounded-lg px-2 py-1.5 flex justify-between items-center"
              >
                <span className="text-[var(--muted)]">{t.label}</span>
                <span className="font-medium text-white">
                  {active}/{count}
                </span>
              </div>
            );
          })}
        </div>

        {/* Completion rate */}
        {(() => {
          const total = allTasks.length;
          const done = allTasks.filter((t) => t.estado === "done").length;
          const rate = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[var(--card-border)] rounded-full h-2">
                <div
                  className="bg-[var(--green)] h-2 rounded-full transition-all"
                  style={{ width: `${rate}%` }}
                />
              </div>
              <span className="text-sm font-medium text-[var(--muted)]">
                {rate}% completado ({done}/{total})
              </span>
            </div>
          );
        })()}

        {/* Recent activity (agent log) -- only for can_see_agent */}
        {canSeeAgent && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--muted)] mb-2">
              Actividad reciente del agente
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {queue
                .filter((item) => item.last_log && item.task_asignado_a === "agent")
                .slice(0, 10)
                .map((item) => (
                  <div
                    key={`log-${item.id}`}
                    className="flex items-center gap-2 text-xs text-[var(--muted)] py-1 border-b border-[var(--card-border)]"
                  >
                    <span className="px-1.5 py-0.5 bg-[var(--purple)]/20 text-[var(--purple-light)] rounded">
                      Bot
                    </span>
                    <span className="font-medium text-white">
                      {item.client_nombre}
                    </span>
                    <span>{item.last_log!.accion}</span>
                    <span className="ml-auto text-[var(--muted)]">
                      {new Date(item.last_log!.created_at).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                ))}
              {queue.filter((item) => item.last_log && item.task_asignado_a === "agent")
                .length === 0 && (
                <p className="text-xs text-[var(--muted)]">
                  Sin actividad reciente del agente
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[var(--card-border)] bg-[var(--card-bg)] text-white rounded-lg px-3 py-2 text-sm w-64 focus:border-[var(--purple)] outline-none"
        />
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value as FilterTipo)}
          className="border border-[var(--card-border)] bg-[var(--card-bg)] text-white rounded-lg px-3 py-2 text-sm focus:border-[var(--purple)] outline-none"
        >
          <option value="todos">Todos los tipos</option>
          <option value="cuotas">Cuotas</option>
          <option value="renovaciones">Renovaciones</option>
          <option value="deudores">Deudores</option>
        </select>
        <select
          value={filterSemaforo}
          onChange={(e) =>
            setFilterSemaforo(e.target.value as FilterSemaforo)
          }
          className="border border-[var(--card-border)] bg-[var(--card-bg)] text-white rounded-lg px-3 py-2 text-sm focus:border-[var(--purple)] outline-none"
        >
          <option value="todos">Todos los semaforos</option>
          <option value="vencido">Vencidas</option>
          <option value="urgente">Urgentes</option>
          <option value="proximo">Proximas</option>
        </select>
      </div>

      {/* Queue Table */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Monto</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Vencimiento</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Dias</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Contacto</th>
                {canSeeAgent && (
                  <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">
                    Agente
                  </th>
                )}
                <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-[var(--card-border)] hover:bg-white/5 ${getSemaforoBg(item.semaforo)}`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${getSemaforoDot(item.semaforo)}`}
                      title={item.semaforo}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-white">{item.client_nombre}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {item.programa ?? ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white">
                      {getTipoLabel(item)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">
                    {item.monto_usd > 0
                      ? `$${item.monto_usd.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {item.fecha_vencimiento ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${getSemaforoColor(item.semaforo)}`}
                    >
                      {getDiasLabel(item.dias_vencido)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--muted)]">
                      {item.estado_contacto ?? "por_contactar"}
                    </span>
                  </td>
                  {canSeeAgent && (
                    <td className="px-4 py-3">
                      {item.task_asignado_a === "agent" ? (
                        <div>
                          <span className="text-xs px-1.5 py-0.5 bg-[var(--purple)]/20 text-[var(--purple-light)] rounded">
                            Bot
                          </span>
                          {item.last_log && (
                            <p className="text-xs text-[var(--muted)] mt-1 truncate max-w-[150px]">
                              {item.last_log.accion}
                            </p>
                          )}
                        </div>
                      ) : item.task_asignado_a === "human" ? (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                          Humano
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMarkContactado(item)}
                        disabled={activeAction === item.id}
                        className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 disabled:opacity-50"
                        title="Marcar contactado"
                      >
                        Contactado
                      </button>
                      <button
                        onClick={() =>
                          setActiveAction(
                            activeAction === `pay-${item.id}`
                              ? null
                              : `pay-${item.id}`
                          )
                        }
                        className="text-xs px-2 py-1 bg-green-500/20 text-[var(--green)] rounded hover:bg-green-500/30"
                        title="Marcar pagado"
                      >
                        Pagado
                      </button>
                      <button
                        onClick={() =>
                          setActiveAction(
                            activeAction === `note-${item.id}`
                              ? null
                              : `note-${item.id}`
                          )
                        }
                        className="text-xs px-2 py-1 bg-white/10 text-[var(--muted)] rounded hover:bg-white/20"
                        title="Agregar nota"
                      >
                        Nota
                      </button>
                      {item.task_id && item.task_prioridad > 1 && (
                        <button
                          onClick={() => handleEscalar(item)}
                          disabled={activeAction === item.id}
                          className="text-xs px-2 py-1 bg-red-500/20 text-[var(--red)] rounded hover:bg-red-500/30 disabled:opacity-50"
                          title="Escalar prioridad"
                        >
                          Escalar
                        </button>
                      )}
                    </div>
                    {/* Inline payment form */}
                    {activeAction === `pay-${item.id}` && (
                      <PaymentMiniForm
                        paymentId={item.payment_id}
                        taskId={item.task_id}
                        defaultMonto={item.monto_usd}
                        sessionTeamMemberId={session.team_member_id}
                        onSuccess={() => {
                          setActiveAction(null);
                          setQueue((prev) =>
                            prev.filter((q) => q.id !== item.id)
                          );
                        }}
                        onCancel={() => setActiveAction(null)}
                      />
                    )}
                    {/* Inline note form */}
                    {activeAction === `note-${item.id}` && (
                      <NoteMiniForm
                        taskId={item.task_id}
                        clientId={item.client_id}
                        authorId={session.team_member_id}
                        onSuccess={() => setActiveAction(null)}
                        onCancel={() => setActiveAction(null)}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={canSeeAgent ? 9 : 8}
                    className="px-4 py-12 text-center text-[var(--muted)]"
                  >
                    No hay items en la cola
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ========================================
// PaymentMiniForm -- inline form to mark paid
// ========================================
function PaymentMiniForm({
  paymentId,
  taskId,
  defaultMonto,
  sessionTeamMemberId,
  onSuccess,
  onCancel,
}: {
  paymentId: string | null;
  taskId: string | null;
  defaultMonto: number;
  sessionTeamMemberId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [monto, setMonto] = useState(defaultMonto);
  const [metodo, setMetodo] = useState("binance");
  const [receptor, setReceptor] = useState("JUANMA");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/cobranzas/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          task_id: taskId,
          monto_usd: monto,
          metodo_pago: metodo,
          receptor,
          cobrador_id: sessionTeamMemberId,
        }),
      });
      if (res.ok) onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2"
    >
      <div className="flex gap-2">
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(Number(e.target.value))}
          className="border border-[var(--card-border)] bg-[var(--background)] text-white rounded px-2 py-1 text-sm w-24 outline-none"
          placeholder="USD"
        />
        <select
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          className="border border-[var(--card-border)] bg-[var(--background)] text-white rounded px-2 py-1 text-sm outline-none"
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
        className="border border-[var(--card-border)] bg-[var(--background)] text-white rounded px-2 py-1 text-sm w-full outline-none"
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
          disabled={loading}
          className="text-xs px-3 py-1 bg-[var(--green)] text-black font-medium rounded hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "..." : "Confirmar pago"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1 bg-white/10 text-[var(--muted)] rounded hover:bg-white/20"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ========================================
// NoteMiniForm -- inline note/log entry
// ========================================
function NoteMiniForm({
  taskId,
  clientId,
  authorId,
  onSuccess,
  onCancel,
}: {
  taskId: string | null;
  clientId: string | null;
  authorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nota.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cobranzas/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          accion: nota,
          author_id: authorId,
        }),
      });
      if (res.ok) {
        setNota("");
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 p-3 bg-white/5 border border-[var(--card-border)] rounded-lg space-y-2"
    >
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        className="border border-[var(--card-border)] bg-[var(--background)] text-white rounded px-2 py-1 text-sm w-full outline-none"
        rows={2}
        placeholder="Agregar nota..."
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !nota.trim()}
          className="text-xs px-3 py-1 bg-[var(--purple)] text-white rounded hover:bg-[var(--purple-dark)] disabled:opacity-50"
        >
          {loading ? "..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1 bg-white/10 text-[var(--muted)] rounded hover:bg-white/20"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
