"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */

// Section 1: Resumen Ejecutivo — Programs
const programsSold = [
  { name: "Mentoria 1K PYF", qty: 48, pct: 45.7, avg: 977, total: 46896 },
  { name: "Mentoria 2.5K Cuotas", qty: 36, pct: 34.3, avg: 2511, total: 90396 },
  { name: "Mentoria 2.5K PYF", qty: 13, pct: 12.4, avg: 2431, total: 31603 },
  { name: "Mentoria Fee", qty: 4, pct: 3.8, avg: 2125, total: 8500 },
  { name: "Mentoria 5K Cuotas", qty: 2, pct: 1.9, avg: 5832, total: 11664 },
  { name: "Mentoria 1K Cuotas", qty: 2, pct: 1.9, avg: 1250, total: 2500 },
];

// Chart: Cash por mes
const cashByMonth = [
  { mes: "Nov", cash: 174450 },
  { mes: "Dic", cash: 75323 },
  { mes: "Ene", cash: 68851 },
  { mes: "Feb", cash: 73665 },
  { mes: "Mar", cash: 153172 },
];

// Donut: leads por estado
const leadsByStatus = [
  { name: "Cerrados", value: 105, color: "#22c55e" },
  { name: "Seguimiento", value: 25, color: "#eab308" },
  { name: "Reservas", value: 17, color: "#3b82f6" },
  { name: "No-show", value: 24, color: "#ef4444" },
  { name: "Otros", value: 7, color: "#9ca3af" },
];

// Section 3: Funnel IG -> Venta
const funnelStages = [
  { name: "Alcance/mes", value: 108243, pct: "" },
  { name: "Visitas perfil", value: 35518, pct: "32.8%" },
  { name: "Clicks enlaces", value: 1733, pct: "4.9%" },
  { name: "Conversaciones DM", value: 2567, pct: "" },
  { name: "Calendly enviado", value: 196, pct: "7.6%" },
  { name: "Agendas formales", value: 178, pct: "90.8%" },
  { name: "Se presentaron", value: 154, pct: "86.5%" },
  { name: "Ventas cerradas", value: 105, pct: "68.2%" },
];

// Section 4: Tiempo de compra
const purchaseTime = [
  { range: "Mismo dia", qty: 52, pct: 77.6 },
  { range: "1-3 dias", qty: 10, pct: 14.9 },
  { range: "4-7 dias", qty: 3, pct: 4.5 },
  { range: "8-14 dias", qty: 1, pct: 1.5 },
  { range: "15+ dias", qty: 1, pct: 1.5 },
];

// Section 8: Revenue por closer
const revenueByCloser = [
  { name: "Jorge", sales: 48, cash: 61160, pct: 45.3 },
  { name: "Ivan", sales: 45, cash: 56541, pct: 41.9 },
  { name: "Joaco", sales: 10, cash: 14050, pct: 10.4 },
  { name: "Otros", sales: 2, cash: 3169, pct: 2.3 },
];

// Section 10: Response time distribution
const responseJorge = [
  { range: "<=5min", pct: 42.4 },
  { range: "<=15min", pct: 62.6 },
  { range: "<=30min", pct: 75.3 },
  { range: "<=1hr", pct: 84.5 },
];
const responseJoaco = [
  { range: "<=5min", pct: 19.6 },
  { range: "<=15min", pct: 38.5 },
  { range: "<=30min", pct: 55.6 },
  { range: "<=1hr", pct: 72.4 },
];
const responseTimeChart = responseJorge.map((r, i) => ({
  range: r.range,
  Jorge: r.pct,
  Joaco: responseJoaco[i].pct,
}));

// Section 9: Setter comparison
const setterComparison = [
  { metric: "Agendas", jorge: "66", joaco: "102" },
  { metric: "Presentadas", jorge: "61", joaco: "85" },
  { metric: "No-show", jorge: "5 (7.6%)", joaco: "15 (14.7%)" },
  { metric: "Show Rate", jorge: "92.4%", joaco: "83.3%" },
  { metric: "Cerrados (como setter)", jorge: "53", joaco: "50" },
  { metric: "Close Rate", jorge: "86.9%", joaco: "58.8%" },
  { metric: "Cash", jorge: "$67,400", joaco: "$64,201" },
  { metric: "Avg Ticket", jorge: "$1,787", joaco: "$1,774" },
  { metric: "Conversaciones", jorge: "1,138", joaco: "1,191" },
  { metric: "Chat->Sale %", jorge: "44.4%", joaco: "20.7%" },
  { metric: "Respuesta mediana", jorge: "8 min", joaco: "24 min" },
];

const setterBarData = [
  { metric: "Agendas", Jorge: 66, Joaco: 102 },
  { metric: "Presentadas", Jorge: 61, Joaco: 85 },
  { metric: "Cerrados", Jorge: 53, Joaco: 50 },
  { metric: "No-show", Jorge: 5, Joaco: 15 },
];

// Section 11: Benchmarks
const benchmarks = [
  { metric: "Show Rate", team: "86.5%", industry: "60-80%", rating: "EXCELENTE", color: "blue" },
  { metric: "Close Rate", team: "68.2%", industry: "20-40%", rating: "EXCEPCIONAL", color: "green" },
  { metric: "Booking Rate", team: "7.6%", industry: "15-25%", rating: "POR DEBAJO", color: "red" },
  { metric: "Revenue/Lead", team: "$758", industry: "$200-500", rating: "EXCELENTE", color: "blue" },
  { metric: "No-Show", team: "13.5%", industry: "20-40%", rating: "EXCELENTE", color: "blue" },
  { metric: "Save Rate IG", team: "12.4%", industry: "3-5%", rating: "EXCEPCIONAL", color: "green" },
  { metric: "Share Rate IG", team: "9.1%", industry: "1-3%", rating: "EXCEPCIONAL", color: "green" },
  { metric: "ER/Reel", team: "2.75%", industry: "1-3%", rating: "BUENO", color: "yellow" },
  { metric: "Non-Followers", team: "95.3%", industry: "50-70%", rating: "VIRAL", color: "green" },
  { metric: "Frecuencia", team: "3.9/dia", industry: "1-2/dia", rating: "MUY ALTA", color: "blue" },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function usd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function num(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function MarzoCompletoReport() {
  return (
    <div className="report-root max-w-[1100px] mx-auto bg-white text-gray-900 print:p-0 print:max-w-full">
      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, aside, [data-sidebar], .no-print, header, .bottom-nav { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
          .report-root { max-width: 100% !important; }
          .page-break { page-break-before: always; }
        }
        @media screen {
          .report-root { padding: 2rem; }
        }
      `}</style>

      {/* ════════════════════════════════════════════
          HEADER
          ════════════════════════════════════════════ */}
      <div className="flex items-center justify-between mb-8 border-b-2 border-gray-900 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-1">Lauti Cardozo Mentoria</p>
          <h1 className="text-3xl font-black tracking-tight">Reporte Mensual Completo</h1>
          <p className="text-base text-gray-500 font-medium">Marzo 2026 &mdash; Periodo 7 Mar &ndash; 7 Abr 2026</p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition cursor-pointer"
        >
          Imprimir / PDF
        </button>
      </div>

      {/* ════════════════════════════════════════════
          SECTION 1: RESUMEN EJECUTIVO
          ════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionTitle number={1}>Resumen Ejecutivo</SectionTitle>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <KPI label="Cash Collected" value={usd(134920)} highlight />
          <KPI label="Ventas Cerradas" value="105" />
          <KPI label="Ticket Promedio" value={usd(1824)} />
          <KPI label="Ticket Moda" value="$1,000" sub="Mentoria 1K PYF" />
          <KPI label="Pipeline Leads" value="178" />
          <KPI label="Show Rate" value="86.5%" sub="154/178" severity="good" />
          <KPI label="Close Rate" value="68.2%" sub="105/154 presentados" severity="good" />
          <KPI label="Tiempo Compra Prom." value="0.9 dias" sub="Mediana: mismo dia" />
          <KPI label="Cierre Mismo Dia" value="77.6%" sub="52 de 67" />
          <KPI label="En Seguimiento" value="25 leads" severity="warn" />
          <KPI label="Reservas Pendientes" value="17 leads" severity="warn" />
          <KPI label="Cuotas Cobradas Mar" value={usd(24540)} sub="34 cuotas con MC asignado" />
        </div>

        <div className="mt-4 border border-amber-300 bg-amber-50 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">Cuotas Pendientes con fecha</p>
          <p className="text-2xl font-black text-amber-900">{usd(5485)} <span className="text-base font-medium text-amber-600">(5 cuotas)</span></p>
          <p className="text-xs text-amber-600 mt-1">120 registros sin fecha de vencimiento no se cuentan</p>
        </div>

        {/* Programs sold table */}
        <div className="mt-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Programas Vendidos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-2.5 font-semibold text-gray-600">Programa</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Ventas</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">%</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Ticket Prom.</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {programsSold.map((p, i) => (
                  <tr key={p.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-right">{p.qty}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{p.pct}%</td>
                    <td className="px-4 py-2.5 text-right">{usd(p.avg)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{usd(p.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                  <td className="px-4 py-2.5">TOTAL</td>
                  <td className="px-4 py-2.5 text-right">105</td>
                  <td className="px-4 py-2.5 text-right">100%</td>
                  <td className="px-4 py-2.5 text-right">{usd(1824)}</td>
                  <td className="px-4 py-2.5 text-right">{usd(191559)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Programs horizontal bar chart */}
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={programsSold} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fill: "#374151", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#374151", fontSize: 11 }} width={140} />
              <Tooltip formatter={(v) => usd(Number(v))} />
              <Bar dataKey="total" name="Revenue" radius={[0, 6, 6, 0]} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CASH COLLECTED TREND + LEADS DONUT
          ════════════════════════════════════════════ */}
      <section className="grid md:grid-cols-2 gap-8 mb-12">
        <div>
          <SectionTitle>Cash Collected por Mes (Nov-Mar)</SectionTitle>
          <div className="h-72 mt-4">
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
        </div>

        <div>
          <SectionTitle>Leads por Estado</SectionTitle>
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={leadsByStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={2} dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}>
                  {leadsByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 2: METRICAS IG
          ════════════════════════════════════════════ */}
      <section className="mb-12 page-break">
        <SectionTitle number={2}>Metricas Instagram &mdash; Trimestre (Dic 31 &ndash; Mar 30)</SectionTitle>
        <p className="text-sm text-gray-500 mt-1 mb-4">Promedios mensuales entre parentesis</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniKPI label="Alcance" value="324,728" sub="~108K/mes" />
          <MiniKPI label="Impresiones" value="5.2M" sub="~1.7M/mes" />
          <MiniKPI label="Seguidores neto" value="+6,425" sub="+8,666 nuevos / -2,241 unfollows" />
          <MiniKPI label="Reels" value="350" sub="~117/mes (3.9/dia)" />
          <MiniKPI label="Interacciones" value="61,776" />
          <MiniKPI label="Likes" value="41,688" />
          <MiniKPI label="Shares" value="5,625" />
          <MiniKPI label="Saves" value="7,687" />
          <MiniKPI label="Comments" value="952" />
          <MiniKPI label="ER/Reel" value="2.75%" />
          <MiniKPI label="Save Rate" value="12.4%" />
          <MiniKPI label="Share Rate" value="9.1%" />
          <MiniKPI label="Non-followers reached" value="95.3%" />
          <MiniKPI label="Leads IG" value="90" sub="~30/mes" />
          <MiniKPI label="Ventas IG" value="24" />
          <MiniKPI label="Cash IG" value="$29,251" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <MiniKPI label="Revenue/1000 alcance" value="$90.08" />
          <MiniKPI label="Revenue/new follower" value="$3.38" />
          <MiniKPI label="Lead rate" value="0.028%" />
          <MiniKPI label="Close rate IG" value="26.7%" />
          <MiniKPI label="Revenue/lead" value="$325" />
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 3: FUNNEL COMPLETO
          ════════════════════════════════════════════ */}
      <section className="mb-12 page-break">
        <SectionTitle number={3}>Funnel Completo (IG &rarr; Venta)</SectionTitle>
        <div className="mt-6 space-y-2">
          {funnelStages.map((stage, i) => {
            const maxVal = funnelStages[0].value;
            const widthPct = Math.max((stage.value / maxVal) * 100, 8);
            const colors = ["#6366f1", "#7c3aed", "#8b5cf6", "#a78bfa", "#c084fc", "#818cf8", "#6366f1", "#22c55e"];
            return (
              <div key={stage.name}>
                <div className="flex justify-between text-sm font-medium mb-1">
                  <span className="text-gray-700">{stage.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{num(stage.value)}</span>
                    {stage.pct && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{stage.pct}</span>}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-9 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-3 text-white text-xs font-bold transition-all"
                    style={{ width: `${widthPct}%`, backgroundColor: colors[i] }}
                  >
                    {i === funnelStages.length - 1 ? usd(134920) : ""}
                  </div>
                </div>
                {i < funnelStages.length - 1 && (
                  <div className="text-center text-gray-300 text-lg leading-none py-0.5">&#8595;</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-center">
          <span className="inline-block bg-emerald-100 text-emerald-800 font-bold text-lg px-6 py-2 rounded-full">
            {usd(134920)} Cash Collected
          </span>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 4: TIEMPO DE COMPRA
          ════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionTitle number={4}>Tiempo de Compra</SectionTitle>
        <div className="grid md:grid-cols-2 gap-8 mt-4">
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-2.5 font-semibold text-gray-600">Rango</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Cantidad</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {purchaseTime.map((p, i) => (
                  <tr key={p.range} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2.5 font-medium">{p.range}</td>
                    <td className="px-4 py-2.5 text-right">{p.qty}</td>
                    <td className="px-4 py-2.5 text-right">{p.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-sm text-indigo-800"><strong>Promedio:</strong> 0.9 dias &bull; <strong>Mediana:</strong> mismo dia</p>
              <p className="text-xs text-indigo-600 mt-1">52 de 67 ventas con datos de fecha = mismo dia (77.6%)</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={purchaseTime} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="range" tick={{ fill: "#374151", fontSize: 11 }} />
                <YAxis tick={{ fill: "#374151", fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="qty" name="Ventas" radius={[6, 6, 0, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 5: JORGE PALACIOS
          ════════════════════════════════════════════ */}
      <section className="mb-12 page-break">
        <SectionTitle number={5}>Performance: Jorge Palacios (Setter + Chat Closer)</SectionTitle>
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
            <h3 className="text-base font-bold mb-3 text-indigo-700">Como Setter</h3>
            <div className="space-y-1.5 text-sm">
              <StatRow label="Agendas" value="66" />
              <StatRow label="Presentadas" value="61" />
              <StatRow label="No-show" value="5 (7.6%)" severity="good" />
              <StatRow label="Show Rate" value="92.4%" severity="good" />
              <StatRow label="Cerrados" value="53" />
              <StatRow label="Close Rate" value="86.9%" severity="good" />
              <StatRow label="Cash" value="$67,400" />
              <StatRow label="Avg Ticket" value="$1,787" />
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
            <h3 className="text-base font-bold mb-3 text-emerald-700">Como Closer (Chat)</h3>
            <div className="space-y-1.5 text-sm">
              <StatRow label="Cierres" value="48" />
              <StatRow label="Close Rate" value="94.1%" severity="good" />
              <StatRow label="Cash" value="$61,160" />
              <StatRow label="Avg Ticket" value="$1,735" />
            </div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mt-4 mb-2">Programas Cerrados</h4>
            <div className="space-y-1 text-sm">
              <StatRow label="1K PYF" value="24 / $23,800" />
              <StatRow label="2.5K Cuotas" value="13 / $33,400" />
              <StatRow label="2.5K PYF" value="8 / $20,100" />
              <StatRow label="Fee" value="2 / $5,000" />
              <StatRow label="1K Cuotas" value="1 / $1,000" />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 6: JOAQUIN IZCURDIA
          ════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionTitle number={6}>Performance: Joaquin Izcurdia (Setter Principal)</SectionTitle>
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
            <h3 className="text-base font-bold mb-3 text-indigo-700">Como Setter</h3>
            <div className="space-y-1.5 text-sm">
              <StatRow label="Agendas" value="102" />
              <StatRow label="Presentadas" value="85" />
              <StatRow label="No-show" value="15 (14.7%)" severity="warn" />
              <StatRow label="Show Rate" value="83.3%" />
              <StatRow label="Cerrados" value="50" />
              <StatRow label="Seguimiento" value="21" />
              <StatRow label="Reservas" value="8" />
              <StatRow label="Close Rate total" value="49.0%" severity="warn" />
              <StatRow label="Close Rate presentadas" value="58.8%" />
              <StatRow label="Cash" value="$64,201" />
              <StatRow label="Avg Ticket" value="$1,774" />
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
            <h3 className="text-base font-bold mb-3 text-emerald-700">Como Closer (Ocasional, 12 calls)</h3>
            <div className="space-y-1.5 text-sm">
              <StatRow label="Cerrados" value="10" />
              <StatRow label="Close Rate" value="83.3%" severity="good" />
              <StatRow label="Cash" value="$14,050" />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 7: IVAN CARBONE
          ════════════════════════════════════════════ */}
      <section className="mb-12 page-break">
        <SectionTitle number={7}>Performance: Ivan Carbone (Closer Principal)</SectionTitle>
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 max-w-lg">
          <h3 className="text-base font-bold mb-3 text-indigo-700">Solo Llamadas</h3>
          <div className="space-y-1.5 text-sm">
            <StatRow label="Calls totales" value="113" />
            <StatRow label="Presentadas" value="89" />
            <StatRow label="No-show" value="22 (19.5%)" severity="bad" />
            <StatRow label="Show Rate" value="78.8%" severity="warn" />
            <StatRow label="Cerrados" value="45" />
            <StatRow label="Seguimiento" value="25" />
            <StatRow label="Reservas" value="12" />
            <StatRow label="Close Rate presentadas" value="50.6%" severity="warn" />
            <StatRow label="Cash" value="$56,541" />
            <StatRow label="Avg Ticket" value="$1,853" />
          </div>
          <h4 className="text-xs font-bold text-gray-500 uppercase mt-4 mb-2">Programas Cerrados</h4>
          <div className="space-y-1 text-sm">
            <StatRow label="2.5K Cuotas" value="20 / $50,300" />
            <StatRow label="1K PYF" value="19 / $18,100" />
            <StatRow label="2.5K PYF" value="3 / $7,500" />
            <StatRow label="Fee" value="1 / $1,000" />
            <StatRow label="1K Cuotas" value="1 / $1,500" />
            <StatRow label="5K Cuotas" value="1 / $5,000" />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 8: COMPARATIVO REVENUE
          ════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionTitle number={8}>Comparativo Revenue por Closer</SectionTitle>

        <div className="grid md:grid-cols-2 gap-8 mt-4">
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-2.5 font-semibold text-gray-600">Closer</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Ventas</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Cash</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {revenueByCloser.map((r, i) => (
                  <tr key={r.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-right">{r.sales}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{usd(r.cash)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 space-y-2">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
                <strong>Jorge:</strong> Setter $67,400 + Closer $61,160
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                <strong>Joaco:</strong> Setter $64,201 + Closer $14,050
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <strong>Ivan:</strong> Closer $56,541
              </div>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByCloser} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fill: "#374151", fontSize: 13 }} />
                <YAxis tick={{ fill: "#374151", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => usd(Number(v))} />
                <Bar dataKey="cash" name="Cash" radius={[6, 6, 0, 0]}>
                  {revenueByCloser.map((_, i) => {
                    const colors = ["#6366f1", "#22c55e", "#8b5cf6", "#9ca3af"];
                    return <Cell key={i} fill={colors[i]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 9: COMPARATIVO SETTERS
          ════════════════════════════════════════════ */}
      <section className="mb-12 page-break">
        <SectionTitle number={9}>Comparativo Setters: Jorge vs Joaquin</SectionTitle>

        <div className="grid md:grid-cols-2 gap-8 mt-4">
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-4 py-2.5 font-semibold text-gray-600">Metrica</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-center">Jorge</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-center">Joaco</th>
                </tr>
              </thead>
              <tbody>
                {setterComparison.map((row, i) => (
                  <tr key={row.metric} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2 font-medium text-gray-700">{row.metric}</td>
                    <td className="px-4 py-2 text-center">{row.jorge}</td>
                    <td className="px-4 py-2 text-center">{row.joaco}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={setterBarData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="metric" tick={{ fill: "#374151", fontSize: 12 }} />
                <YAxis tick={{ fill: "#374151", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Jorge" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Joaco" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <p className="text-sm text-indigo-800">
            <strong>Insight clave:</strong> Jorge genera menos volumen pero mayor calidad. Joaco genera mas volumen pero menor conversion. Jorge convierte 44.4% de chats en venta vs 20.7% de Joaco, con mediana de respuesta de 8 min vs 24 min.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 10: METRICAS DE CHAT
          ════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionTitle number={10}>Metricas de Chat</SectionTitle>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <MiniKPI label="Conversaciones" value="2,567" />
          <MiniKPI label="Mensajes totales" value="65,149" />
          <MiniKPI label="Msg/conv" value="25.4" />
          <MiniKPI label="Leads nuevos" value="1,920 (74.8%)" />
          <MiniKPI label="Recurrentes" value="647 (25.2%)" />
          <MiniKPI label="Conv. Jorge" value="1,138 (48.9%)" />
          <MiniKPI label="Conv. Joaco" value="1,191 (51.1%)" />
        </div>

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-sm"><strong>Jorge chat-&gt;sale:</strong> <span className="text-emerald-700 font-bold">44.4%</span></p>
            <p className="text-xs text-gray-500 mt-1">Mediana respuesta: 8 min</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm"><strong>Joaco chat-&gt;sale:</strong> <span className="text-amber-700 font-bold">20.7%</span></p>
            <p className="text-xs text-gray-500 mt-1">Mediana respuesta: 24 min</p>
          </div>
        </div>

        {/* Response time chart */}
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mt-6 mb-3">Distribucion Tiempo de Respuesta (acumulado)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={responseTimeChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="range" tick={{ fill: "#374151", fontSize: 12 }} />
              <YAxis tick={{ fill: "#374151", fontSize: 12 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              <Bar dataKey="Jorge" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Joaco" fill="#c084fc" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 11: BENCHMARKS
          ════════════════════════════════════════════ */}
      <section className="mb-12 page-break">
        <SectionTitle number={11}>Benchmarks vs Industria</SectionTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2.5 font-semibold text-gray-600">Metrica</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-center">Equipo</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-center">Industria</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-center">Rating</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b, i) => {
                const ratingColors: Record<string, string> = {
                  green: "bg-emerald-100 text-emerald-800",
                  blue: "bg-blue-100 text-blue-800",
                  yellow: "bg-amber-100 text-amber-800",
                  red: "bg-red-100 text-red-800",
                };
                return (
                  <tr key={b.metric} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2.5 font-medium">{b.metric}</td>
                    <td className="px-4 py-2.5 text-center font-semibold">{b.team}</td>
                    <td className="px-4 py-2.5 text-center text-gray-500">{b.industry}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${ratingColors[b.color]}`}>
                        {b.rating}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 12: ALERTAS
          ════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionTitle number={12}>Alertas</SectionTitle>
        <div className="space-y-4 mt-4">
          <div className="border-l-4 border-red-500 bg-red-50 rounded-r-xl p-5">
            <h3 className="font-bold text-red-800 mb-1">Campo &quot;Lead Calificado&quot; sin usar</h3>
            <p className="text-sm text-red-700">0 leads marcados como calificados en marzo. Este campo deberia usarse para filtrar leads de alta calidad antes de agendar.</p>
          </div>
          <div className="border-l-4 border-amber-500 bg-amber-50 rounded-r-xl p-5">
            <h3 className="font-bold text-amber-800 mb-1">Booking Rate 7.6% muy bajo</h3>
            <p className="text-sm text-amber-700">Solo 196 de 2,567 conversaciones reciben un link de Calendly. Industria: 15-25%. Oportunidad masiva de mejora en la conversion de chat a agenda.</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 13: PIPELINE ABRIL
          ════════════════════════════════════════════ */}
      <section className="mb-12">
        <SectionTitle number={13}>Pipeline Abril 2026</SectionTitle>
        <div className="mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2.5 font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Leads</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Valor Estimado</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="px-4 py-2.5 font-medium">Seguimiento</td>
                <td className="px-4 py-2.5 text-right">25</td>
                <td className="px-4 py-2.5 text-right">{usd(45600)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 font-medium">Reservas</td>
                <td className="px-4 py-2.5 text-right">17</td>
                <td className="px-4 py-2.5 text-right">{usd(31008)}</td>
              </tr>
              <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                <td className="px-4 py-2.5">TOTAL</td>
                <td className="px-4 py-2.5 text-right">42</td>
                <td className="px-4 py-2.5 text-right">{usd(76608)}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm text-emerald-800">
              <strong>Si cierra 50%:</strong> Abril arranca con ~{usd(38000)} en movimiento
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SECTION 14: COMISIONES
          ════════════════════════════════════════════ */}
      <section className="mb-12 page-break">
        <SectionTitle number={14}>Comisiones del Periodo</SectionTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2.5 font-semibold text-gray-600">Persona</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Closer</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Setter</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Cobranzas</th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="px-4 py-2.5 font-medium">Jorge</td>
                <td className="px-4 py-2.5 text-right">{usd(6936)}</td>
                <td className="px-4 py-2.5 text-right">{usd(3844)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right font-bold">{usd(10780)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 font-medium">Joaquin</td>
                <td className="px-4 py-2.5 text-right">{usd(2315)}</td>
                <td className="px-4 py-2.5 text-right">{usd(3476)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right font-bold">{usd(5791)}</td>
              </tr>
              <tr className="bg-white">
                <td className="px-4 py-2.5 font-medium">Ivan</td>
                <td className="px-4 py-2.5 text-right">{usd(4894)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right font-bold">{usd(4894)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 font-medium">Mel</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right">{usd(2134)}</td>
                <td className="px-4 py-2.5 text-right font-bold">{usd(2134)}</td>
              </tr>
              <tr className="bg-white">
                <td className="px-4 py-2.5 font-medium">Hernan</td>
                <td className="px-4 py-2.5 text-right">{usd(180)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right font-bold">{usd(180)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2.5 font-medium">Juanma</td>
                <td className="px-4 py-2.5 text-right">{usd(250)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right font-bold">{usd(250)}</td>
              </tr>
              <tr className="bg-white">
                <td className="px-4 py-2.5 font-medium">Juan Goupil</td>
                <td className="px-4 py-2.5 text-right">{usd(110)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right text-gray-300">&mdash;</td>
                <td className="px-4 py-2.5 text-right font-bold">{usd(110)}</td>
              </tr>
              <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                <td className="px-4 py-2.5">TOTAL</td>
                <td className="px-4 py-2.5 text-right">{usd(14685)}</td>
                <td className="px-4 py-2.5 text-right">{usd(7320)}</td>
                <td className="px-4 py-2.5 text-right">{usd(2134)}</td>
                <td className="px-4 py-2.5 text-right">{usd(24139)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════════ */}
      <div className="border-t-2 border-gray-200 pt-4 mt-12 text-center text-xs text-gray-400">
        Generado por Lauti CRM &bull; Periodo fiscal Marzo 2026 (7 Mar &ndash; 7 Abr) &bull; Reporte Completo
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function SectionTitle({ children, number }: { children: React.ReactNode; number?: number }) {
  return (
    <h2 className="text-xl font-bold tracking-tight border-b-2 border-gray-800 pb-2 flex items-center gap-3">
      {number !== undefined && (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-bold shrink-0">
          {number}
        </span>
      )}
      <span>{children}</span>
    </h2>
  );
}

function KPI({ label, value, sub, severity, highlight }: {
  label: string;
  value: string;
  sub?: string;
  severity?: "good" | "warn" | "bad";
  highlight?: boolean;
}) {
  const borderColor = highlight ? "border-emerald-500 bg-emerald-50" :
    severity === "bad" ? "border-red-400" :
    severity === "warn" ? "border-amber-400" :
    severity === "good" ? "border-emerald-400" :
    "border-gray-200";
  return (
    <div className={`border ${borderColor} rounded-xl p-4 ${!highlight ? "bg-gray-50" : ""}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-black ${highlight ? "text-emerald-800" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function MiniKPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatRow({ label, value, severity }: { label: string; value: string; severity?: "good" | "warn" | "bad" }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold ${
        severity === "good" ? "text-emerald-600" :
        severity === "bad" ? "text-red-600" :
        severity === "warn" ? "text-amber-600" :
        "text-gray-900"
      }`}>{value}</span>
    </div>
  );
}
