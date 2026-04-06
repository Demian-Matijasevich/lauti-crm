"use client";

import { useState, useMemo } from "react";
import MonthSelector77 from "@/app/components/MonthSelector77";
import { formatUSD } from "@/lib/format";
import { getFiscalStart } from "@/lib/date-utils";
import { getCloserRankings } from "@/lib/gamification";
import type { Lead } from "@/lib/types";
import type { CloserRanking } from "@/lib/gamification";

interface Props {
  leads: Lead[];
  currentMemberId: string;
}

export default function LeaderboardClient({ leads, currentMemberId }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(
    getFiscalStart().toISOString().split("T")[0]
  );

  const rankings: CloserRanking[] = useMemo(() => {
    const d = new Date(selectedMonth);
    return getCloserRankings(leads, d);
  }, [leads, selectedMonth]);

  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Ranking de closers por cash collected
          </p>
        </div>
        <MonthSelector77 value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Podium — Top 3 */}
      {rankings.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {/* 2nd place */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 text-center mt-8">
            <span className="text-4xl block mb-2">{"\u{1F948}"}</span>
            <p className="text-lg font-bold text-white">
              {rankings[1].nombre}
            </p>
            <p className="text-[var(--green)] font-bold text-xl mt-1">
              {formatUSD(rankings[1].cash)}
            </p>
            <p className="text-[var(--muted)] text-sm mt-1">
              {rankings[1].cerradas} cierres
            </p>
          </div>

          {/* 1st place */}
          <div className="bg-[var(--card-bg)] border-2 border-[var(--yellow)] rounded-xl p-6 text-center">
            <span className="text-5xl block mb-2">{"\u{1F947}"}</span>
            <p className="text-xl font-bold text-white">
              {rankings[0].nombre}
            </p>
            <p className="text-[var(--green)] font-bold text-2xl mt-1">
              {formatUSD(rankings[0].cash)}
            </p>
            <p className="text-[var(--muted)] text-sm mt-1">
              {rankings[0].cerradas} cierres
            </p>
            {rankings[0].streak >= 3 && (
              <p className="text-sm mt-2">
                {"\u{1F525}"} Racha de {rankings[0].streak} dias
              </p>
            )}
          </div>

          {/* 3rd place */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 text-center mt-8">
            <span className="text-4xl block mb-2">{"\u{1F949}"}</span>
            <p className="text-lg font-bold text-white">
              {rankings[2].nombre}
            </p>
            <p className="text-[var(--green)] font-bold text-xl mt-1">
              {formatUSD(rankings[2].cash)}
            </p>
            <p className="text-[var(--muted)] text-sm mt-1">
              {rankings[2].cerradas} cierres
            </p>
          </div>
        </div>
      )}

      {/* Full Ranking Table */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Ranking Completo
        </h2>
        {rankings.length === 0 ? (
          <p className="text-[var(--muted)] text-sm py-4 text-center">
            Sin datos para este periodo
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-xs uppercase">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Closer</th>
                  <th className="text-right py-2 px-3">Cash Collected</th>
                  <th className="text-right py-2 px-3">Cierres</th>
                  <th className="text-right py-2 px-3">Streak</th>
                  <th className="text-left py-2 px-3">Badges</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => {
                  const isMe = r.closerId === currentMemberId;
                  const earnedBadges = r.badges.filter((b) => b.earned);

                  return (
                    <tr
                      key={r.closerId}
                      className={`border-t border-[var(--card-border)] ${
                        isMe ? "bg-[var(--purple)]/10" : ""
                      }`}
                    >
                      <td className="py-3 px-3">
                        <span className="text-lg">
                          {r.position <= 3
                            ? medals[r.position - 1]
                            : r.position}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-white font-medium">
                          {r.streak >= 3 ? "\u{1F525} " : ""}
                          {r.nombre}
                          {isMe ? (
                            <span className="text-[var(--purple-light)] text-xs ml-1">
                              (vos)
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[var(--green)]">
                        {formatUSD(r.cash)}
                      </td>
                      <td className="py-3 px-3 text-right text-white">
                        {r.cerradas}
                      </td>
                      <td className="py-3 px-3 text-right text-white">
                        {r.streak > 0 ? (
                          <span>
                            {r.streak} dia{r.streak > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {earnedBadges.map((b) => (
                            <span
                              key={b.id}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--purple)]/15 text-[var(--purple-light)]"
                              title={b.label}
                            >
                              {b.icon} {b.label}
                            </span>
                          ))}
                          {earnedBadges.length === 0 && (
                            <span className="text-[var(--muted)] text-xs">
                              {"\u2014"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
