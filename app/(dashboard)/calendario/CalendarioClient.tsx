"use client";

import { useState, useMemo } from "react";
import type { Lead, Payment, RenewalQueueRow } from "@/lib/types";
import { formatUSD } from "@/lib/format";

interface Props {
  leads: Pick<Lead, "id" | "nombre" | "fecha_llamada" | "estado">[];
  payments: Pick<Payment, "id" | "client_id" | "lead_id" | "numero_cuota" | "monto_usd" | "fecha_vencimiento" | "estado">[];
  renewals: RenewalQueueRow[];
}

const DAYS_HEADER = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

interface DayData {
  date: string; // YYYY-MM-DD
  day: number;
  isCurrentMonth: boolean;
  llamadas: Props["leads"];
  cuotas: Props["payments"];
  renovaciones: Props["renewals"];
}

function getMonthGrid(year: number, month: number, leads: Props["leads"], payments: Props["payments"], renewals: Props["renewals"]): DayData[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: DayData[] = [];

  // Fill leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(makeDayData(d, false, leads, payments, renewals));
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push(makeDayData(date, true, leads, payments, renewals));
  }

  // Fill trailing days
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push(makeDayData(d, false, leads, payments, renewals));
    }
  }

  return days;
}

function makeDayData(date: Date, isCurrentMonth: boolean, leads: Props["leads"], payments: Props["payments"], renewals: Props["renewals"]): DayData {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return {
    date: dateStr,
    day: date.getDate(),
    isCurrentMonth,
    llamadas: leads.filter((l) => l.fecha_llamada === dateStr),
    cuotas: payments.filter((p) => p.fecha_vencimiento === dateStr),
    renovaciones: renewals.filter((r) => r.fecha_vencimiento === dateStr),
  };
}

export default function CalendarioClient({ leads, payments, renewals }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const grid = useMemo(() => getMonthGrid(year, month, leads, payments, renewals), [year, month, leads, payments, renewals]);

  const selectedDayData = useMemo(() => {
    if (!selectedDay) return null;
    return grid.find((d) => d.date === selectedDay) ?? null;
  }, [selectedDay, grid]);

  const monthLabel = new Date(year, month).toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
    setSelectedDay(null);
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-white hover:bg-white/10 text-sm">
          &larr; Anterior
        </button>
        <h2 className="text-lg font-semibold text-white capitalize">{monthLabel}</h2>
        <button onClick={nextMonth} className="px-3 py-1 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-white hover:bg-white/10 text-sm">
          Siguiente &rarr;
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Llamadas</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> Cuotas</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Renovaciones</span>
      </div>

      {/* Calendar grid */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-[var(--card-border)]">
          {DAYS_HEADER.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-[var(--muted)] uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const hasItems = day.llamadas.length > 0 || day.cuotas.length > 0 || day.renovaciones.length > 0;
            const isToday = day.date === todayStr;
            const isSelected = day.date === selectedDay;

            return (
              <div
                key={day.date}
                onClick={() => hasItems ? setSelectedDay(isSelected ? null : day.date) : undefined}
                className={`min-h-[80px] p-2 border-b border-r border-[var(--card-border)] transition-colors ${
                  !day.isCurrentMonth ? "opacity-30" : ""
                } ${hasItems ? "cursor-pointer hover:bg-white/5" : ""} ${
                  isSelected ? "bg-[var(--purple)]/10 ring-1 ring-[var(--purple)]" : ""
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? "text-[var(--purple-light)] font-bold" : "text-white"}`}>
                  {day.day}
                </div>
                <div className="flex flex-wrap gap-1">
                  {day.llamadas.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-blue-400">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      {day.llamadas.length}
                    </span>
                  )}
                  {day.cuotas.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-yellow-400">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                      {day.cuotas.length}
                    </span>
                  )}
                  {day.renovaciones.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-green-400">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      {day.renovaciones.length}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded day panel */}
      {selectedDayData && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4 space-y-4">
          <h3 className="text-white font-semibold">
            {new Date(selectedDayData.date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </h3>

          {/* Llamadas */}
          {selectedDayData.llamadas.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-blue-400 uppercase mb-2">Llamadas programadas ({selectedDayData.llamadas.length})</h4>
              <div className="space-y-1">
                {selectedDayData.llamadas.map((l) => (
                  <div key={l.id} className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                    <span className="text-sm text-white">{l.nombre}</span>
                    <span className="text-xs text-[var(--muted)]">{l.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cuotas */}
          {selectedDayData.cuotas.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-yellow-400 uppercase mb-2">Cuotas por vencer ({selectedDayData.cuotas.length})</h4>
              <div className="space-y-1">
                {selectedDayData.cuotas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    <span className="text-sm text-white">Cuota #{p.numero_cuota}</span>
                    <span className="text-sm font-medium text-yellow-400">{formatUSD(p.monto_usd)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Renovaciones */}
          {selectedDayData.renovaciones.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-green-400 uppercase mb-2">Renovaciones ({selectedDayData.renovaciones.length})</h4>
              <div className="space-y-1">
                {selectedDayData.renovaciones.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm text-white">{r.nombre}</span>
                      <span className="text-xs text-[var(--muted)] ml-2">{r.programa}</span>
                    </div>
                    <span className={`text-xs font-medium ${
                      r.semaforo === "vencido" ? "text-[var(--red)]" :
                      r.semaforo === "urgente" ? "text-[var(--yellow)]" :
                      "text-[var(--green)]"
                    }`}>
                      {r.dias_restantes}d restantes
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
