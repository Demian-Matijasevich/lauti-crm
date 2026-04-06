"use client";

import { useState, useMemo } from "react";
import type { TeamMember, AuthSession, LeadScore } from "@/lib/types";
import type { LeadWithTeam } from "@/lib/queries/leads";
import { LEAD_ESTADOS_LABELS } from "@/lib/constants";
import { formatUSD, formatDate } from "@/lib/format";
import { getFiscalMonthOptions, getFiscalEnd } from "@/lib/date-utils";
import StatusBadge from "@/app/components/StatusBadge";

interface Props {
  leads: LeadWithTeam[];
  closers: TeamMember[];
  setters: TeamMember[];
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

export default function LlamadasClient({ leads, closers, setters, session }: Props) {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");
  const [closerFilter, setCloserFilter] = useState<string>("todos");
  const [setterFilter, setSetterFilter] = useState<string>("todos");
  const [monthFilter, setMonthFilter] = useState<string>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const monthOptions = useMemo(() => getFiscalMonthOptions(12), []);

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

  const estadoOptions = Object.entries(LEAD_ESTADOS_LABELS);

  const inputClass =
    "bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--purple)]";
  const selectClass = inputClass;

  // Suppress unused variable warning
  void session;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Llamadas</h1>
        <p className="text-sm text-[var(--muted)]">
          {filtered.length} de {leads.length} leads
        </p>
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
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--muted)]">
                    No se encontraron leads con esos filtros.
                  </td>
                </tr>
              )}
              {filtered.map((lead) => (
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
                </tr>
              ))}
            </tbody>
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
