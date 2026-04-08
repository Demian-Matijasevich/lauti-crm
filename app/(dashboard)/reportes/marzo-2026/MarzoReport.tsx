"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

/* ───────────────────── DATA ───────────────────── */

const cashByMonth = [
  { mes: "Nov", cash: 57_120 },
  { mes: "Dic", cash: 65_300 },
  { mes: "Ene", cash: 81_540 },
  { mes: "Feb", cash: 73_665 },
  { mes: "Mar", cash: 147_866 },
];

const leadsByStatus = [
  { name: "Cerrados", value: 98, color: "#22c55e" },
  { name: "No-show", value: 26, color: "#ef4444" },
  { name: "Seguimiento", value: 29, color: "#eab308" },
  { name: "Reserva", value: 11, color: "#3b82f6" },
  { name: "No calificado", value: 6, color: "#9ca3af" },
  { name: "Cancel/Reprog", value: 4, color: "#f97316" },
  { name: "No cierre", value: 1, color: "#a855f7" },
];

const funnelData = [
  { name: "Leads totales", value: 178 },
  { name: "Presentados", value: 130 },
  { name: "Cerrados", value: 98 },
];

const treasuryData = [
  { receptor: "Financiera", cash: 54_170, pct: 36.6 },
  { receptor: "Binance Lauti", cash: 27_569, pct: 18.6 },
  { receptor: "Juanma", cash: 19_750, pct: 13.4 },
  { receptor: "Cta USD Lauti", cash: 18_900, pct: 12.8 },
  { receptor: "Cta ARS Lauti", cash: 18_477, pct: 12.5 },
  { receptor: "Efectivo Lauti", cash: 5_200, pct: 3.5 },
  { receptor: "Sin asignar", cash: 3_800, pct: 2.6 },
];

const FUNNEL_COLORS = ["#6366f1", "#8b5cf6", "#22c55e"];

/* ───────────────────── HELPERS ───────────────────── */

function usd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function DeltaBadge({ value, suffix = "vs Feb" }: { value: number; suffix?: string }) {
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${positive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
      {positive ? "▲" : "▼"} {Math.abs(value).toFixed(1)}% {suffix}
    </span>
  );
}

/* ───────────────────── COMPONENT ───────────────────── */

export default function MarzoReport() {
  return (
    <div className="report-root max-w-[1100px] mx-auto bg-white text-gray-900 print:p-0 print:max-w-full">
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, aside, [data-sidebar], .no-print, header { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
          .report-root { max-width: 100% !important; }
          .page-break { page-break-before: always; }
        }
        @media screen {
          .report-root { padding: 2rem; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-8 border-b-2 border-gray-900 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Reporte Mensual</h1>
          <p className="text-lg text-gray-500 font-medium">Marzo 2026 &mdash; Periodo fiscal 8 Mar &ndash; 7 Abr</p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition cursor-pointer"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <KPI label="Facturacion" value={usd(200_464)} />
        <KPI label="Cash Collected" value={usd(147_866)} delta={100.7} />
        <KPI label="Cuotas Cobradas" value={usd(20_540)} sub="20 cuotas" delta={124} />
        <KPI label="Saldo Pendiente" value={usd(23_468)} />
        <KPI label="Cuotas Pendientes" value={usd(123_777)} sub="113 cuotas con vencimiento" severity="warn" />
        <KPI label="Renovaciones" value="$0" severity="bad" sub="Feb: $3,375" />
        <KPI label="Total Leads" value="178" />
        <KPI label="Tasa de Cierre" value="55%" sub="98/178 leads" />
      </section>

      {/* ── CASH COLLECTED TREND ── */}
      <section className="mb-10">
        <SectionTitle>Cash Collected por Mes</SectionTitle>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashByMonth} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tick={{ fill: "#374151", fontSize: 13 }} />
              <YAxis tick={{ fill: "#374151", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => usd(Number(v))} />
              <Bar dataKey="cash" name="Cash" radius={[6, 6, 0, 0]}>
                {cashByMonth.map((_, i) => (
                  <Cell key={i} fill={i === cashByMonth.length - 1 ? "#22c55e" : "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── LEADS DISTRIBUTION + FUNNEL ── */}
      <section className="grid md:grid-cols-2 gap-8 mb-10">
        <div>
          <SectionTitle>Distribucion de Leads</SectionTitle>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadsByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {leadsByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <SectionTitle>Funnel de Ventas</SectionTitle>
          <div className="space-y-3 mt-4">
            {funnelData.map((stage, i) => {
              const maxVal = funnelData[0].value;
              const widthPct = (stage.value / maxVal) * 100;
              return (
                <div key={stage.name}>
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span>{stage.name}</span>
                    <span className="font-bold">{stage.value}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-3 text-white text-xs font-bold transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: FUNNEL_COLORS[i] }}
                    >
                      {((stage.value / maxVal) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PER-CLOSER PERFORMANCE ── */}
      <section className="mb-10 page-break">
        <SectionTitle>Performance por Closer / Setter</SectionTitle>
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <CloserCard
            name="Ivan"
            role="Closer (llamadas)"
            stats={[
              { label: "Agendas", value: "114" },
              { label: "Presentadas", value: "81" },
              { label: "Cerradas", value: "34" },
              { label: "Show Up", value: "71.1%", severity: "bad" },
              { label: "Cierre/presentadas", value: "42.0%", severity: "warn" },
              { label: "AOV", value: "$1,932" },
              { label: "Comision", value: "$4,914" },
            ]}
          />
          <CloserCard
            name="Jorge"
            role="Setter + Closer (chat)"
            stats={[
              { label: "Cierres chat", value: "49" },
              { label: "Agendas setter", value: "26" },
              { label: "Cierre", value: "95.9%", severity: "good" },
              { label: "AOV", value: "$1,864" },
              { label: "Comision total", value: "$10,435" },
              { label: "Com. closer", value: "$6,706" },
              { label: "Com. setter", value: "$3,729" },
            ]}
          />
          <CloserCard
            name="Joaquin"
            role="Setter principal + cierra chat"
            stats={[
              { label: "Agendas generadas", value: "83" },
              { label: "Cerradas (agenda)", value: "28" },
              { label: "Cierres propios", value: "15" },
              { label: "Cierre propio", value: "93.3%", severity: "good" },
              { label: "AOV", value: "$1,700" },
              { label: "Comision total", value: "$5,670" },
              { label: "Com. closer + setter", value: "$2,315 + $3,355" },
            ]}
          />
          <CloserCard
            name="Mel"
            role="Cobranzas"
            stats={[
              { label: "Cuotas cobradas", value: "20" },
              { label: "Total cobrado", value: "$20,540" },
              { label: "Comision", value: "$1,504" },
            ]}
          />
        </div>
      </section>

      {/* ── INSTAGRAM ── */}
      <section className="mb-10">
        <SectionTitle>Instagram Metrics &mdash; Trimestre (Dic 31 &ndash; Mar 30) &middot; Promedio mensual entre par&eacute;ntesis</SectionTitle>
        <p className="text-sm text-gray-500 mt-1 mb-3">Datos disponibles: trimestre completo (3 meses). Promedio mensual estimado entre paréntesis.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniKPI label="Alcance" value="324,728 (~108K/mes)" />
          <MiniKPI label="Impresiones" value="5.2M (~1.7M/mes)" />
          <MiniKPI label="Seguidores neto" value="+6,425 (~2.1K/mes)" />
          <MiniKPI label="Reels publicados" value="350 (~117/mes)" />
          <MiniKPI label="Interacciones reels" value="61,776 (~20.6K/mes)" />
          <MiniKPI label="ER por reel" value="2.75%" />
          <MiniKPI label="Saves/reel" value="22" />
          <MiniKPI label="Shares/reel" value="16" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <MiniKPI label="Leads IG (trimestre)" value="90 (~30/mes)" />
          <MiniKPI label="Ventas IG" value="24 (~8/mes)" />
          <MiniKPI label="Cash IG" value="$29,251 (~$9.8K/mes)" />
          <MiniKPI label="Close rate IG" value="26.7%" />
          <MiniKPI label="Lead rate (alcance→lead)" value="0.028%" />
          <MiniKPI label="Revenue/lead" value="$325" />
          <MiniKPI label="Likes totales" value="41,688" />
          <MiniKPI label="Guardados totales" value="7,687" />
        </div>
        <p className="text-xs text-gray-400 mt-2">* Para métricas mensuales exactas de IG, cargar datos semanales en la sección IG Metrics del CRM.</p>
      </section>

      {/* ── TREASURY ── */}
      <section className="mb-10 page-break">
        <SectionTitle>Tesoreria por Receptor</SectionTitle>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={treasuryData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fill: "#374151", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="receptor" tick={{ fill: "#374151", fontSize: 12 }} width={110} />
              <Tooltip formatter={(v) => usd(Number(v))} />
              <Bar dataKey="cash" name="Cash" radius={[0, 6, 6, 0]} fill="#6366f1">
                {treasuryData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "#6366f1" : i < 3 ? "#8b5cf6" : "#a78bfa"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── BOTTLENECK ANALYSIS ── */}
      <section className="mb-10">
        <SectionTitle>Analisis de Cuellos de Botella</SectionTitle>
        <div className="space-y-5 mt-4">
          <Bottleneck
            severity="red"
            title="Show Up Rate de Ivan (71.1%)"
            number={1}
          >
            <p>33 de 114 agendas no se presentaron. Si el show up fuera 85% (benchmark), habria tenido <strong>97 presentadas</strong> en vez de 81 &rarr; ~16 cierres mas &rarr; <strong>~$30K mas en cash</strong>.</p>
            <Action>Implementar recordatorio 24hs + 1hr antes por WA. Calificar mejor los leads antes de agendar.</Action>
          </Bottleneck>

          <Bottleneck
            severity="yellow"
            title="Cierre de Ivan (42%)"
            number={2}
          >
            <p>De 81 presentadas, solo cerro 34. Jorge cierra al 95.9% y Joaquin al 93.3% (por chat, pero igualmente). Si Ivan cerrara al 60%, habria cerrado <strong>49</strong> &rarr; 15 cierres mas &rarr; <strong>~$29K mas</strong>.</p>
            <Action>Revisar grabaciones de llamadas no cerradas. Identificar leads mal calificados y objeciones recurrentes.</Action>
          </Bottleneck>

          <Bottleneck
            severity="green"
            title="Cuotas pendientes ($123,777)"
            number={3}
          >
            <p>113 cuotas con vencimiento por cobrar. Si Mel cobra el 50%, son <strong>$62K adicionales</strong>.</p>
            <Action>Priorizar las de mayor monto primero. Sistema de cobro automatizado con recordatorios.</Action>
          </Bottleneck>

          <Bottleneck
            severity="yellow"
            title="$0 en Renovaciones"
            number={4}
          >
            <p>Febrero tuvo $3,375 en renovaciones. Marzo tuvo <strong>$0</strong>.</p>
            <Action>Identificar clientes que vencen en Abril. Contactar 15 dias antes con oferta de renovacion.</Action>
          </Bottleneck>

          <Bottleneck
            severity="red"
            title="IG Lead Rate bajo (0.028%)"
            number={5}
          >
            <p>324K alcance pero solo 90 leads. El funnel de contenido a lead no esta convirtiendo.</p>
            <Action>Mejorar CTAs en reels. Agregar links en bio. Usar mas historias con link directo.</Action>
          </Bottleneck>

          <Bottleneck
            severity="green"
            title="Revenue por follower nuevo"
            number={6}
          >
            <p>8,666 nuevos seguidores pero solo $29K revenue de IG. <strong>$3.37 por nuevo follower</strong>.</p>
            <Action>Nurture sequence para nuevos seguidores. DM automatico de bienvenida.</Action>
          </Bottleneck>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div className="border-t-2 border-gray-200 pt-4 mt-12 text-center text-xs text-gray-400">
        Generado por Lauti CRM &bull; Periodo fiscal Marzo 2026 (8 Mar &ndash; 7 Abr)
      </div>
    </div>
  );
}

/* ───────────────────── SUB-COMPONENTS ───────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-bold tracking-tight border-b border-gray-200 pb-2">
      {children}
    </h2>
  );
}

function KPI({ label, value, delta, sub, severity }: {
  label: string;
  value: string;
  delta?: number;
  sub?: string;
  severity?: "good" | "warn" | "bad";
}) {
  const borderColor = severity === "bad" ? "border-red-400" : severity === "warn" ? "border-amber-400" : "border-gray-200";
  return (
    <div className={`border ${borderColor} rounded-xl p-4 bg-gray-50`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {delta !== undefined && <DeltaBadge value={delta} />}
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function MiniKPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

function CloserCard({ name, role, stats }: {
  name: string;
  role: string;
  stats: { label: string; value: string; severity?: "good" | "warn" | "bad" }[];
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
      <div className="mb-3">
        <h3 className="text-lg font-bold">{name}</h3>
        <p className="text-xs text-gray-500">{role}</p>
      </div>
      <div className="space-y-1.5">
        {stats.map((s) => (
          <div key={s.label} className="flex justify-between text-sm">
            <span className="text-gray-600">{s.label}</span>
            <span className={`font-semibold ${
              s.severity === "good" ? "text-emerald-600" :
              s.severity === "bad" ? "text-red-600" :
              s.severity === "warn" ? "text-amber-600" :
              "text-gray-900"
            }`}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bottleneck({ severity, title, number, children }: {
  severity: "red" | "yellow" | "green";
  title: string;
  number: number;
  children: React.ReactNode;
}) {
  const icon = severity === "red" ? "\uD83D\uDD34" : severity === "yellow" ? "\uD83D\uDFE1" : "\uD83D\uDFE2";
  const bgColor = severity === "red" ? "bg-red-50 border-red-200" : severity === "yellow" ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200";
  return (
    <div className={`border rounded-xl p-5 ${bgColor}`}>
      <h3 className="font-bold text-base mb-2">
        {icon} #{number}: {title}
      </h3>
      <div className="text-sm text-gray-700 space-y-2">{children}</div>
    </div>
  );
}

function Action({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/70 border border-gray-200 rounded-lg p-3 mt-2">
      <p className="text-xs uppercase text-gray-500 font-semibold mb-1">Accion recomendada</p>
      <p className="text-sm font-medium text-gray-800">{children}</p>
    </div>
  );
}
