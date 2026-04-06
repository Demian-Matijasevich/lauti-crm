"use client";

import { useState, useMemo } from "react";
import type { AuthSession, AgentTask } from "@/lib/types";
import type { CobranzasQueueItem } from "@/lib/queries/cobranzas";

interface Props {
  initialQueue: CobranzasQueueItem[];
  allTasks: AgentTask[];
  session: AuthSession;
}

type FilterTipo = "todos" | "cuotas" | "renovaciones" | "deudores";
type FilterSemaforo = "todos" | "vencido" | "urgente" | "proximo";

export default function CobranzasClient({
  initialQueue,
  allTasks,
  session,
}: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [filterTipo, setFilterTipo] = useState<FilterTipo>("todos");
  const [filterSemaforo, setFilterSemaforo] = useState<FilterSemaforo>("todos");
  const [search, setSearch] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);

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
  const totalVencidas = queue.filter((i) => i.semaforo === "vencido").length;
  const totalUrgentes = queue.filter((i) => i.semaforo === "urgente").length;
  const montoVencido = queue
    .filter((i) => i.semaforo === "vencido")
    .reduce((sum, i) => sum + i.monto_usd, 0);

  function getSemaforoEmoji(s: string) {
    if (s === "vencido") return "\u{1F534}";
    if (s === "urgente") return "\u{1F7E1}";
    if (s === "proximo") return "\u{1F7E0}";
    return "\u{1F7E2}";
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
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">Vencidas</p>
          <p className="text-2xl font-bold text-red-800">{totalVencidas}</p>
          <p className="text-sm text-red-500">
            ${montoVencido.toLocaleString()} USD
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-600 font-medium">Urgentes</p>
          <p className="text-2xl font-bold text-yellow-800">{totalUrgentes}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-600 font-medium">Total en cola</p>
          <p className="text-2xl font-bold text-blue-800">{queue.length}</p>
        </div>
      </div>

      {/* Agent Tasks Dashboard (Task 6) */}
      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Panel de Tareas</h2>
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
              className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
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
                color: "text-yellow-600 bg-yellow-50",
              },
              {
                label: "En progreso",
                count: allTasks.filter((t) => t.estado === "in_progress").length,
                color: "text-blue-600 bg-blue-50",
              },
              {
                label: "Completadas",
                count: allTasks.filter((t) => t.estado === "done").length,
                color: "text-green-600 bg-green-50",
              },
              {
                label: "Fallidas",
                count: allTasks.filter((t) => t.estado === "failed").length,
                color: "text-red-600 bg-red-50",
              },
            ] as const
          ).map((stat) => (
            <div
              key={stat.label}
              className={`rounded-lg p-3 ${stat.color}`}
            >
              <p className="text-xs font-medium">{stat.label}</p>
              <p className="text-xl font-bold">{stat.count}</p>
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
                className="text-xs border rounded-lg px-2 py-1.5 flex justify-between items-center"
              >
                <span className="text-gray-600">{t.label}</span>
                <span className="font-medium">
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
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${rate}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600">
                {rate}% completado ({done}/{total})
              </span>
            </div>
          );
        })()}

        {/* Recent activity (agent log) -- only for can_see_agent */}
        {canSeeAgent && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              Actividad reciente del agente
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {queue
                .filter((item) => item.last_log && item.task_asignado_a === "agent")
                .slice(0, 10)
                .map((item) => (
                  <div
                    key={`log-${item.id}`}
                    className="flex items-center gap-2 text-xs text-gray-500 py-1 border-b border-gray-50"
                  >
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                      Bot
                    </span>
                    <span className="font-medium text-gray-700">
                      {item.client_nombre}
                    </span>
                    <span>{item.last_log!.accion}</span>
                    <span className="ml-auto text-gray-400">
                      {new Date(item.last_log!.created_at).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                ))}
              {queue.filter((item) => item.last_log && item.task_asignado_a === "agent")
                .length === 0 && (
                <p className="text-xs text-gray-400">
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
          className="border rounded-lg px-3 py-2 text-sm w-64"
        />
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value as FilterTipo)}
          className="border rounded-lg px-3 py-2 text-sm"
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
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="todos">Todos los semaforos</option>
          <option value="vencido">Vencidas</option>
          <option value="urgente">Urgentes</option>
          <option value="proximo">Proximas</option>
        </select>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 font-medium text-gray-600">Monto</th>
                <th className="px-4 py-3 font-medium text-gray-600">Dias</th>
                <th className="px-4 py-3 font-medium text-gray-600">Contacto</th>
                {canSeeAgent && (
                  <th className="px-4 py-3 font-medium text-gray-600">
                    Agente
                  </th>
                )}
                <th className="px-4 py-3 font-medium text-gray-600">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 ${
                    item.semaforo === "vencido" ? "bg-red-50/30" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span title={item.semaforo}>
                      {getSemaforoEmoji(item.semaforo)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{item.client_nombre}</p>
                      <p className="text-xs text-gray-500">
                        {item.programa ?? ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100">
                      {getTipoLabel(item)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {item.monto_usd > 0
                      ? `$${item.monto_usd.toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${
                        item.dias_vencido < 0
                          ? "text-red-600"
                          : item.dias_vencido <= 7
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {getDiasLabel(item.dias_vencido)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">
                      {item.estado_contacto ?? "por_contactar"}
                    </span>
                  </td>
                  {canSeeAgent && (
                    <td className="px-4 py-3">
                      {item.task_asignado_a === "agent" ? (
                        <div>
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            Bot
                          </span>
                          {item.last_log && (
                            <p className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                              {item.last_log.accion}
                            </p>
                          )}
                        </div>
                      ) : item.task_asignado_a === "human" ? (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                          Humano
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMarkContactado(item)}
                        disabled={activeAction === item.id}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
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
                        className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
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
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        title="Agregar nota"
                      >
                        Nota
                      </button>
                      {item.task_id && item.task_prioridad > 1 && (
                        <button
                          onClick={() => handleEscalar(item)}
                          disabled={activeAction === item.id}
                          className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
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
                    colSpan={canSeeAgent ? 8 : 7}
                    className="px-4 py-12 text-center text-gray-400"
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
      className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg space-y-2"
    >
      <div className="flex gap-2">
        <input
          type="number"
          value={monto}
          onChange={(e) => setMonto(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm w-24"
          placeholder="USD"
        />
        <select
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
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
          disabled={loading}
          className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "..." : "Confirmar pago"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
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
      className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2"
    >
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        className="border rounded px-2 py-1 text-sm w-full"
        rows={2}
        placeholder="Agregar nota..."
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !nota.trim()}
          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
