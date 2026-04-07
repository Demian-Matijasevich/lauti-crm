"use client";

import { useState, useMemo, useCallback } from "react";
import type { TeamMember, AuthSession, LeadScore, Payment } from "@/lib/types";
import type { LeadWithTeam } from "@/lib/queries/leads";
import { LEAD_ESTADOS_LABELS } from "@/lib/constants";
import { formatUSD, formatDate } from "@/lib/format";
import { getFiscalMonthOptions, getFiscalEnd } from "@/lib/date-utils";
import StatusBadge from "@/app/components/StatusBadge";

interface Props {
  leads: LeadWithTeam[];
  closers: TeamMember[];
  setters: TeamMember[];
  payments: Payment[];
  session: AuthSession;
}

const SCORE_COLORS: Record<string, string> = {
  A: "bg-green-500/15 text-green-400 border-green-500/20",
  B: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  C: "bg-orange-400/15 text-orange-400 border-orange-400/20",
  D: "bg-red-500/15 text-red-400 border-red-500/20",
};

function LeadScoreBadge({ score }: { score: LeadScore | null }) {
  if (!score) return <span className="text-xs text-muted">--</span>;
  const color = SCORE_COLORS[score] || "bg-gray-500/15 text-gray-400 border-gray-500/20";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${color}`}>
      {score}
    </span>
  );
}

const AIRTABLE_BASE_URL = "https://airtable.com/appRlYaISIRx0QEVe/tbleCytRILP3D7Q3N";

export default function LlamadasClient({ leads, closers, setters, payments, session }: Props) {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");
  const [closerFilter, setCloserFilter] = useState<string>("todos");
  const [setterFilter, setSetterFilter] = useState<string>("todos");
  const [monthFilter, setMonthFilter] = useState<string>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const monthOptions = useMemo(() => getFiscalMonthOptions(12), []);

  // Group payments by lead_id for O(1) lookups
  const paymentsByLead = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of payments) {
      if (!p.lead_id) continue;
      const arr = map.get(p.lead_id);
      if (arr) arr.push(p);
      else map.set(p.lead_id, [p]);
    }
    return map;
  }, [payments]);

  // Helper: get audit data for a lead
  const getAuditData = useCallback(
    (leadId: string, ticketTotal: number) => {
      const leadPayments = paymentsByLead.get(leadId) || [];
      const pagados = leadPayments.filter((p) => p.estado === "pagado");
      const cashCollected = pagados.reduce((sum, p) => sum + p.monto_usd, 0);
      const cuotasPagadas = pagados.filter((p) => p.numero_cuota > 1).length;
      const saldoPendiente = ticketTotal - cashCollected;
      const receptor = leadPayments.length > 0 ? leadPayments[0].receptor : null;
      return { cashCollected, cuotasPagadas, saldoPendiente, receptor };
    },
    [paymentsByLead]
  );

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSearch =
          lead.nombre?.toLowerCase().includes(q) ||
          lead.instagram?.toLowerCase().includes(q) ||
          lead.email?.toLowerCase().includes(q) ||
          lead.telefono?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Estado filter
      if (estadoFilter !== "todos" && lead.estado !== estadoFilter) return false;

      // Closer filter
      if (closerFilter !== "todos" && lead.closer_id !== closerFilter) return false;

      // Setter filter
      if (setterFilter !== "todos" && lead.setter_id !== setterFilter) return false;

      // Month filter (7-7)
      if (monthFilter !== "todos" && lead.fecha_llamada) {
        const llamadaDate = new Date(lead.fecha_llamada);
        const monthStart = new Date(monthFilter);
        const monthEnd = getFiscalEnd(monthStart);
        if (llamadaDate < monthStart || llamadaDate > monthEnd) return false;
      }

      return true;
    });
  }, [leads, search, estadoFilter, closerFilter, setterFilter, monthFilter]);

  // Summary totals
  const totals = useMemo(() => {
    let totalTicket = 0;
    let totalCash = 0;
    let totalSaldo = 0;
    let totalAtCash = 0;
    for (const lead of filtered) {
      const audit = getAuditData(lead.id, lead.ticket_total);
      totalTicket += lead.ticket_total;
      totalCash += audit.cashCollected;
      totalSaldo += audit.saldoPendiente;
      totalAtCash += (lead.at_cash_total || 0);
    }
    return { totalTicket, totalCash, totalSaldo, totalAtCash };
  }, [filtered, getAuditData]);

  // CSV export
  const handleExportCSV = useCallback(() => {
    const headers = [
      "Nombre",
      "Instagram",
      "Fecha",
      "Estado",
      "Closer",
      "Setter",
      "Ticket Total",
      "Score",
      "Cash Collected",
      "Cuotas Pagadas",
      "Saldo Pendiente",
      "Receptor",
      "Airtable ID",
    ];

    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = filtered.map((lead) => {
      const audit = getAuditData(lead.id, lead.ticket_total);
      return [
        lead.nombre || "",
        lead.instagram ? `@${lead.instagram.replace(/^@/, "")}` : "",
        lead.fecha_llamada || "",
        LEAD_ESTADOS_LABELS[lead.estado] || lead.estado,
        lead.closer?.nombre || "",
        lead.setter?.nombre || "",
        lead.ticket_total.toString(),
        lead.lead_score || "",
        audit.cashCollected.toString(),
        audit.cuotasPagadas.toString(),
        audit.saldoPendiente.toString(),
        audit.receptor || "",
        lead.airtable_id || "",
      ].map(escapeCSV);
    });

    // Add totals row
    rows.push([
      "TOTALES",
      "",
      "",
      "",
      "",
      "",
      totals.totalTicket.toString(),
      "",
      totals.totalCash.toString(),
      "",
      totals.totalSaldo.toString(),
      "",
      "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llamadas_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, getAuditData, totals]);

  const estadoOptions = Object.entries(LEAD_ESTADOS_LABELS);

  const inputClass =
    "bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--purple)]";
  const selectClass = inputClass;

  // Suppress unused variable warning
  void session;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Llamadas</h1>
          <p className="text-sm text-[var(--muted)]">
            {filtered.length} de {leads.length} leads
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="text-sm font-medium bg-[var(--purple)] hover:bg-[var(--purple-dark)] text-white px-4 py-2 rounded-lg transition-colors"
        >
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, IG, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} w-64`}
        />

        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className={selectClass}
        >
          <option value="todos">Todos los estados</option>
          {estadoOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={closerFilter}
          onChange={(e) => setCloserFilter(e.target.value)}
          className={selectClass}
        >
          <option value="todos">Todos los closers</option>
          {closers.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        <select
          value={setterFilter}
          onChange={(e) => setSetterFilter(e.target.value)}
          className={selectClass}
        >
          <option value="todos">Todos los setters</option>
          {setters.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>

        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className={selectClass}
        >
          <option value="todos">Todos los meses</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] text-left">
                <th className="px-4 py-3 text-[var(--muted)] font-medium">Nombre</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium">Instagram</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium">Fecha</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium">Estado</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium">Closer</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium">Setter</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium text-right">Ticket</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium text-center">Score</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium text-right">Cash Collected</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium text-center">Cuotas Pagadas</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium text-right">Saldo Pendiente</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium">Receptor</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium text-right">AT Cash 7-7</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium text-right">Diferencia</th>
                <th className="px-4 py-3 text-[var(--muted)] font-medium">Airtable ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-4 py-12 text-center text-[var(--muted)]">
                    No se encontraron leads con esos filtros.
                  </td>
                </tr>
              )}
              {filtered.map((lead) => {
                const audit = getAuditData(lead.id, lead.ticket_total);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                    className="border-b border-[var(--card-border)] hover:bg-[var(--purple)]/5 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                      {lead.nombre || "Sin nombre"}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {lead.instagram ? `@${lead.instagram.replace(/^@/, "")}` : "---"}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {formatDate(lead.fecha_llamada)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={lead.estado}
                        label={LEAD_ESTADOS_LABELS[lead.estado] || lead.estado}
                      />
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {lead.closer?.nombre || "---"}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {lead.setter?.nombre || "---"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {lead.ticket_total > 0 ? formatUSD(lead.ticket_total) : "---"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <LeadScoreBadge score={lead.lead_score} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {audit.cashCollected > 0 ? (
                        <span className="text-green-400">{formatUSD(audit.cashCollected)}</span>
                      ) : (
                        "---"
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      {audit.cuotasPagadas > 0 ? audit.cuotasPagadas : "---"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {audit.saldoPendiente > 0 ? (
                        <span className="text-red-400">{formatUSD(audit.saldoPendiente)}</span>
                      ) : audit.saldoPendiente < 0 ? (
                        <span className="text-yellow-400">{formatUSD(audit.saldoPendiente)}</span>
                      ) : (
                        "---"
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)] text-xs">
                      {audit.receptor || "---"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {(lead.at_cash_total || 0) > 0 ? (
                        <span className="text-blue-400">{formatUSD(lead.at_cash_total || 0)}</span>
                      ) : (
                        "---"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {(() => {
                        const atTotal = lead.at_cash_total || 0;
                        if (atTotal === 0 && audit.cashCollected === 0) return "---";
                        const diff = audit.cashCollected - atTotal;
                        if (diff === 0) return <span className="text-green-400">OK</span>;
                        if (diff > 0) return <span className="text-yellow-400">+{formatUSD(diff)}</span>;
                        return <span className="text-red-400">-{formatUSD(Math.abs(diff))}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {lead.airtable_id ? (
                        <a
                          href={`${AIRTABLE_BASE_URL}/${lead.airtable_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                        >
                          {lead.airtable_id.slice(0, 10)}...
                        </a>
                      ) : (
                        <span className="text-[var(--muted)]">---</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Summary row */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--purple)]/30 bg-[var(--purple)]/5 font-semibold">
                  <td className="px-4 py-3" colSpan={6}>
                    TOTALES ({filtered.length} leads)
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUSD(totals.totalTicket)}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-mono text-green-400">
                    {formatUSD(totals.totalCash)}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-mono text-red-400">
                    {formatUSD(totals.totalSaldo)}
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-mono text-blue-400">
                    {formatUSD(totals.totalAtCash)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {(() => {
                      const diff = totals.totalCash - totals.totalAtCash;
                      if (diff === 0) return <span className="text-green-400">OK</span>;
                      if (diff > 0) return <span className="text-yellow-400">+{formatUSD(diff)}</span>;
                      return <span className="text-red-400">-{formatUSD(Math.abs(diff))}</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Expanded Lead Detail (inline) */}
      {expandedId && (() => {
        const lead = filtered.find((l) => l.id === expandedId);
        if (!lead) return null;
        return (
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{lead.nombre}</h3>
              <button
                onClick={() => setExpandedId(null)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] text-lg"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Email</p>
                <p>{lead.email || "---"}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Telefono</p>
                <p>{lead.telefono || "---"}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Fuente</p>
                <p>{lead.fuente || "---"}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Programa</p>
                <p>{lead.programa_pitcheado || "---"}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Plan de pago</p>
                <p>{lead.plan_pago || "---"}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Calificado</p>
                <p>{lead.lead_calificado || "---"}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Decisor</p>
                <p>{lead.decisor || "---"}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs mb-0.5">Experiencia ecommerce</p>
                <p>{lead.experiencia_ecommerce || "---"}</p>
              </div>
            </div>

            {(lead.contexto_setter || lead.reporte_general || lead.notas_internas) && (
              <div className="space-y-3 pt-3 border-t border-[var(--card-border)]">
                {lead.contexto_setter && (
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Contexto setter</p>
                    <p className="text-sm leading-relaxed">{lead.contexto_setter}</p>
                  </div>
                )}
                {lead.reporte_general && (
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Reporte general</p>
                    <p className="text-sm leading-relaxed">{lead.reporte_general}</p>
                  </div>
                )}
                {lead.notas_internas && (
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Notas internas</p>
                    <p className="text-sm leading-relaxed">{lead.notas_internas}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <a
                href="/form/llamada"
                className="text-sm font-medium bg-[var(--purple)] hover:bg-[var(--purple-dark)] text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cargar resultado
              </a>
              <a
                href="/pipeline"
                className="text-sm font-medium border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)] px-4 py-2 rounded-lg transition-colors"
              >
                Ver en pipeline
              </a>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
