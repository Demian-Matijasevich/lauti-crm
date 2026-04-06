"use client";

import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import KPICard from "@/app/components/KPICard";
import type { IgMetrics } from "@/lib/types";
import { formatUSD } from "@/lib/format";

interface Props {
  metrics: IgMetrics[];
  current: IgMetrics | null;
  previous: IgMetrics | null;
}

// ------- Helpers -------

function delta(curr: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

function pct(num: number, den: number): string {
  return den === 0 ? "0.0%" : (safeDiv(num, den) * 100).toFixed(1) + "%";
}

// ------- Sub-components -------

function FunnelRow({
  label,
  value,
  rate,
}: {
  label: string;
  value: number;
  rate: string | null;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--card-border)]">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-white font-semibold">{value.toLocaleString()}</span>
        {rate && (
          <span className="text-xs text-[var(--purple-light)] w-16 text-right">{rate}</span>
        )}
      </div>
    </div>
  );
}

function RatesTable({
  current,
  previous,
}: {
  current: IgMetrics;
  previous: IgMetrics | null;
}) {
  const er = current.total_seguidores > 0
    ? (current.total_interacciones / current.total_seguidores) * 100
    : 0;
  const erReel = current.reels_publicados > 0
    ? (current.interacciones_reels / current.reels_publicados / (current.total_seguidores || 1)) * 100
    : 0;
  const saveRate = current.reels_publicados > 0
    ? (current.guardados_reels / (current.interacciones_reels || 1)) * 100
    : 0;
  const shareRate = current.reels_publicados > 0
    ? (current.compartidos_reels / (current.interacciones_reels || 1)) * 100
    : 0;
  const alcanceToVisita = pct(current.visitas_perfil, current.cuentas_alcanzadas);
  const visitaToEnlace = pct(current.toques_enlaces, current.visitas_perfil);
  const leadRate = pct(current.leads_ig, current.toques_enlaces);
  const closeRate = pct(current.ventas_ig, current.leads_ig);
  const revPerLead = current.leads_ig > 0 ? current.cash_ig / current.leads_ig : 0;
  const revPer1kAlcance = current.cuentas_alcanzadas > 0
    ? (current.cash_ig / current.cuentas_alcanzadas) * 1000
    : 0;

  const prevEr = previous && previous.total_seguidores > 0
    ? (previous.total_interacciones / previous.total_seguidores) * 100
    : null;

  const rates = [
    { label: "Engagement Rate", value: er.toFixed(2) + "%", prev: prevEr ? prevEr.toFixed(2) + "%" : null },
    { label: "ER/Reel", value: erReel.toFixed(2) + "%", prev: null },
    { label: "Save Rate (reels)", value: saveRate.toFixed(1) + "%", prev: null },
    { label: "Share Rate (reels)", value: shareRate.toFixed(1) + "%", prev: null },
    { label: "Alcance -> Visita", value: alcanceToVisita, prev: null },
    { label: "Visita -> Enlace", value: visitaToEnlace, prev: null },
    { label: "Lead Rate (enlace -> lead)", value: leadRate, prev: null },
    { label: "Close Rate (lead -> venta)", value: closeRate, prev: null },
    { label: "Revenue / Lead", value: formatUSD(revPerLead), prev: null },
    { label: "Revenue / 1K Alcance", value: formatUSD(revPer1kAlcance), prev: null },
  ];

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Rates</h3>
      <div className="space-y-1">
        {rates.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-[var(--card-border)] last:border-0">
            <span className="text-xs text-[var(--muted)]">{r.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white font-medium">{r.value}</span>
              {r.prev && (
                <span className="text-xs text-[var(--muted)]">prev: {r.prev}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekComparison({
  current,
  previous,
}: {
  current: IgMetrics;
  previous: IgMetrics | null;
}) {
  if (!previous) return null;

  const rows = [
    { label: "Alcance", curr: current.cuentas_alcanzadas, prev: previous.cuentas_alcanzadas },
    { label: "Impresiones", curr: current.impresiones, prev: previous.impresiones },
    { label: "Visitas Perfil", curr: current.visitas_perfil, prev: previous.visitas_perfil },
    { label: "Toques Enlace", curr: current.toques_enlaces, prev: previous.toques_enlaces },
    { label: "Seguidores Neto", curr: current.nuevos_seguidores - current.unfollows, prev: previous.nuevos_seguidores - previous.unfollows },
    { label: "Interacciones", curr: current.total_interacciones, prev: previous.total_interacciones },
    { label: "Leads IG", curr: current.leads_ig, prev: previous.leads_ig },
    { label: "Ventas IG", curr: current.ventas_ig, prev: previous.ventas_ig },
    { label: "Cash IG", curr: current.cash_ig, prev: previous.cash_ig },
  ];

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">
        Comparativa: {current.periodo} vs {previous.periodo}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--muted)] text-xs uppercase">
              <th className="text-left py-1">Metrica</th>
              <th className="text-right py-1">{previous.periodo}</th>
              <th className="text-right py-1">{current.periodo}</th>
              <th className="text-right py-1">Delta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = delta(r.curr, r.prev);
              return (
                <tr key={r.label} className="border-t border-[var(--card-border)]">
                  <td className="py-1.5 text-[var(--muted)]">{r.label}</td>
                  <td className="py-1.5 text-right text-white">{r.prev.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-white font-medium">{r.curr.toLocaleString()}</td>
                  <td className={`py-1.5 text-right font-medium ${
                    d !== null && d >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                  }`}>
                    {d !== null ? `${d >= 0 ? "+" : ""}${d.toFixed(1)}%` : "\u2014"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------- Add Metric Form -------

const INITIAL_FORM = {
  periodo: "",
  fecha_inicio: "",
  fecha_fin: "",
  cuentas_alcanzadas: 0,
  delta_alcance_pct: 0,
  impresiones: 0,
  delta_impresiones_pct: 0,
  visitas_perfil: 0,
  delta_visitas_pct: 0,
  toques_enlaces: 0,
  delta_enlaces_pct: 0,
  pct_alcance_no_seguidores: 0,
  nuevos_seguidores: 0,
  delta_seguidores_pct: 0,
  unfollows: 0,
  total_seguidores: 0,
  total_interacciones: 0,
  delta_interacciones_pct: 0,
  cuentas_interaccion: 0,
  pct_interaccion_no_seguidores: 0,
  reels_publicados: 0,
  interacciones_reels: 0,
  delta_reels_pct: 0,
  likes_reels: 0,
  comentarios_reels: 0,
  compartidos_reels: 0,
  guardados_reels: 0,
  posts_publicados: 0,
  interacciones_posts: 0,
  delta_posts_pct: 0,
  likes_posts: 0,
  comentarios_posts: 0,
  compartidos_posts: 0,
  guardados_posts: 0,
  stories_publicadas: 0,
  interacciones_stories: 0,
  delta_stories_pct: 0,
  respuestas_stories: 0,
  conversaciones_dm: 0,
  pct_hombres: 0,
  pct_mujeres: 0,
  top_paises: "",
  top_ciudades: "",
  top_edades: "",
  leads_ig: 0,
  ventas_ig: 0,
  cash_ig: 0,
};

type FormField = { key: string; label: string; type: "text" | "number" | "date" };

const FORM_SECTIONS: { title: string; fields: FormField[] }[] = [
  {
    title: "General",
    fields: [
      { key: "periodo", label: "Periodo (ej: 'Semana 14')", type: "text" },
      { key: "fecha_inicio", label: "Fecha Inicio", type: "date" },
      { key: "fecha_fin", label: "Fecha Fin", type: "date" },
    ],
  },
  {
    title: "Alcance e Impresiones",
    fields: [
      { key: "cuentas_alcanzadas", label: "Cuentas Alcanzadas", type: "number" },
      { key: "delta_alcance_pct", label: "Delta Alcance %", type: "number" },
      { key: "impresiones", label: "Impresiones", type: "number" },
      { key: "delta_impresiones_pct", label: "Delta Impresiones %", type: "number" },
      { key: "visitas_perfil", label: "Visitas Perfil", type: "number" },
      { key: "delta_visitas_pct", label: "Delta Visitas %", type: "number" },
      { key: "toques_enlaces", label: "Toques Enlace", type: "number" },
      { key: "delta_enlaces_pct", label: "Delta Enlaces %", type: "number" },
      { key: "pct_alcance_no_seguidores", label: "% Alcance No Seguidores", type: "number" },
    ],
  },
  {
    title: "Seguidores",
    fields: [
      { key: "nuevos_seguidores", label: "Nuevos Seguidores", type: "number" },
      { key: "delta_seguidores_pct", label: "Delta Seguidores %", type: "number" },
      { key: "unfollows", label: "Unfollows", type: "number" },
      { key: "total_seguidores", label: "Total Seguidores", type: "number" },
    ],
  },
  {
    title: "Interacciones",
    fields: [
      { key: "total_interacciones", label: "Total Interacciones", type: "number" },
      { key: "delta_interacciones_pct", label: "Delta Interacciones %", type: "number" },
      { key: "cuentas_interaccion", label: "Cuentas que Interactuaron", type: "number" },
      { key: "pct_interaccion_no_seguidores", label: "% Interaccion No Seguidores", type: "number" },
    ],
  },
  {
    title: "Reels",
    fields: [
      { key: "reels_publicados", label: "Reels Publicados", type: "number" },
      { key: "interacciones_reels", label: "Interacciones Reels", type: "number" },
      { key: "delta_reels_pct", label: "Delta Reels %", type: "number" },
      { key: "likes_reels", label: "Likes Reels", type: "number" },
      { key: "comentarios_reels", label: "Comentarios Reels", type: "number" },
      { key: "compartidos_reels", label: "Compartidos Reels", type: "number" },
      { key: "guardados_reels", label: "Guardados Reels", type: "number" },
    ],
  },
  {
    title: "Posts",
    fields: [
      { key: "posts_publicados", label: "Posts Publicados", type: "number" },
      { key: "interacciones_posts", label: "Interacciones Posts", type: "number" },
      { key: "delta_posts_pct", label: "Delta Posts %", type: "number" },
      { key: "likes_posts", label: "Likes Posts", type: "number" },
      { key: "comentarios_posts", label: "Comentarios Posts", type: "number" },
      { key: "compartidos_posts", label: "Compartidos Posts", type: "number" },
      { key: "guardados_posts", label: "Guardados Posts", type: "number" },
    ],
  },
  {
    title: "Stories",
    fields: [
      { key: "stories_publicadas", label: "Stories Publicadas", type: "number" },
      { key: "interacciones_stories", label: "Interacciones Stories", type: "number" },
      { key: "delta_stories_pct", label: "Delta Stories %", type: "number" },
      { key: "respuestas_stories", label: "Respuestas Stories", type: "number" },
    ],
  },
  {
    title: "DMs y Demograficos",
    fields: [
      { key: "conversaciones_dm", label: "Conversaciones DM", type: "number" },
      { key: "pct_hombres", label: "% Hombres", type: "number" },
      { key: "pct_mujeres", label: "% Mujeres", type: "number" },
      { key: "top_paises", label: "Top Paises", type: "text" },
      { key: "top_ciudades", label: "Top Ciudades", type: "text" },
      { key: "top_edades", label: "Top Edades", type: "text" },
    ],
  },
  {
    title: "Business (IG -> Ventas)",
    fields: [
      { key: "leads_ig", label: "Leads desde IG", type: "number" },
      { key: "ventas_ig", label: "Ventas desde IG", type: "number" },
      { key: "cash_ig", label: "Cash desde IG (USD)", type: "number" },
    ],
  },
];

function AddMetricForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(key: string, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ig-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }

      setForm(INITIAL_FORM);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {FORM_SECTIONS.map((section) => (
        <div key={section.title}>
          <h4 className="text-xs uppercase text-[var(--muted)] font-semibold mb-2">
            {section.title}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {section.fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-[var(--muted)] block mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={(form as Record<string, unknown>)[f.key] as string | number}
                  onChange={(e) =>
                    updateField(
                      f.key,
                      f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value
                    )
                  }
                  className="w-full px-2 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--card-border)] text-white text-sm focus:border-[var(--purple)] outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="text-[var(--red)] text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white font-semibold disabled:opacity-50 hover:bg-[var(--purple-dark)] transition-colors"
      >
        {loading ? "Guardando..." : "Guardar Metricas IG"}
      </button>
    </form>
  );
}

// ------- Main Component -------

const CHART_COLORS = {
  alcance: "#8b5cf6",
  impresiones: "#a78bfa",
  seguidores: "#22c55e",
  nuevos: "#3b82f6",
  unfollows: "#ef4444",
  reels: "#8b5cf6",
  posts: "#3b82f6",
  stories: "#eab308",
};

export default function IgMetricsClient({ metrics, current, previous }: Props) {
  const [showForm, setShowForm] = useState(false);

  // Chart data -- chronological order
  const chartData = [...metrics].reverse().map((m) => ({
    periodo: m.periodo || m.fecha_inicio || "\u2014",
    alcance: m.cuentas_alcanzadas,
    impresiones: m.impresiones,
    seguidores: m.total_seguidores,
    nuevos: m.nuevos_seguidores,
    unfollows: m.unfollows,
    interacciones_reels: m.interacciones_reels,
    interacciones_posts: Number(m.interacciones_posts ?? 0),
    interacciones_stories: Number(m.interacciones_stories ?? 0),
  }));

  const seguidoresNeto = current
    ? current.nuevos_seguidores - current.unfollows
    : 0;

  const er = current && current.total_seguidores > 0
    ? (current.total_interacciones / current.total_seguidores) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">IG Metrics</h1>
          <p className="text-sm text-[var(--muted)]">
            {current?.periodo || "Sin datos"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg bg-[var(--purple)] text-white text-sm font-medium hover:bg-[var(--purple-dark)] transition-colors"
        >
          {showForm ? "Ver Dashboard" : "+ Cargar Metricas"}
        </button>
      </div>

      {showForm ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
          <AddMetricForm onSuccess={() => window.location.reload()} />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          {current && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                label="Alcance"
                value={current.cuentas_alcanzadas}
                delta={Number(current.delta_alcance_pct) || delta(current.cuentas_alcanzadas, previous?.cuentas_alcanzadas ?? 0)}
              />
              <KPICard
                label="Seguidores (neto)"
                value={seguidoresNeto}
                delta={previous ? delta(seguidoresNeto, previous.nuevos_seguidores - previous.unfollows) : null}
              />
              <KPICard
                label="Interacciones"
                value={current.total_interacciones}
                delta={Number(current.delta_interacciones_pct) || delta(current.total_interacciones, previous?.total_interacciones ?? 0)}
              />
              <KPICard
                label="Engagement Rate"
                value={er}
                format="pct"
              />
            </div>
          )}

          {/* Charts */}
          {chartData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Alcance + Impresiones over time */}
              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Alcance e Impresiones</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="periodo" tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                      labelStyle={{ color: "#e5e5e5" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="alcance" stroke={CHART_COLORS.alcance} strokeWidth={2} name="Alcance" dot={false} />
                    <Line type="monotone" dataKey="impresiones" stroke={CHART_COLORS.impresiones} strokeWidth={2} name="Impresiones" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Seguidores over time */}
              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Seguidores</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="periodo" tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                      labelStyle={{ color: "#e5e5e5" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="seguidores" stroke={CHART_COLORS.seguidores} strokeWidth={2} name="Total" dot={false} />
                    <Line type="monotone" dataKey="nuevos" stroke={CHART_COLORS.nuevos} strokeWidth={1.5} name="Nuevos" dot={false} />
                    <Line type="monotone" dataKey="unfollows" stroke={CHART_COLORS.unfollows} strokeWidth={1.5} name="Unfollows" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Interacciones por tipo (bar) */}
              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Interacciones por Tipo</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="periodo" tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                      labelStyle={{ color: "#e5e5e5" }}
                    />
                    <Legend />
                    <Bar dataKey="interacciones_reels" fill={CHART_COLORS.reels} name="Reels" />
                    <Bar dataKey="interacciones_posts" fill={CHART_COLORS.posts} name="Posts" />
                    <Bar dataKey="interacciones_stories" fill={CHART_COLORS.stories} name="Stories" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Funnel */}
              {current && (
                <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Funnel IG</h3>
                  <FunnelRow label="Alcance" value={current.cuentas_alcanzadas} rate={null} />
                  <FunnelRow label="Visita Perfil" value={current.visitas_perfil} rate={pct(current.visitas_perfil, current.cuentas_alcanzadas)} />
                  <FunnelRow label="Toque Enlace" value={current.toques_enlaces} rate={pct(current.toques_enlaces, current.visitas_perfil)} />
                  <FunnelRow label="Lead" value={current.leads_ig} rate={pct(current.leads_ig, current.toques_enlaces)} />
                  <FunnelRow label="Venta" value={current.ventas_ig} rate={pct(current.ventas_ig, current.leads_ig)} />
                  <FunnelRow label="Cash" value={current.cash_ig} rate={formatUSD(current.cash_ig)} />
                </div>
              )}
            </div>
          )}

          {/* Rates Table + Week Comparison */}
          {current && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RatesTable current={current} previous={previous} />
              <WeekComparison current={current} previous={previous} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
