"use client";

import type { AuthSession, TrackerSession, SessionAvailability } from "@/lib/types";

interface Props {
  sessions: TrackerSession[];
  availability: SessionAvailability[];
  session: AuthSession;
}

export default function TrackerClient({ sessions, availability, session }: Props) {
  // Suppress unused variable warnings
  void session;

  return (
    <div className="space-y-4">
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6">
        <p className="text-sm text-[var(--muted)]">
          Tracker 1a1 — {sessions.length} sesiones, {availability.length} alumnos con disponibilidad.
        </p>
        <p className="text-xs text-[var(--muted)] mt-2">
          Componente completo disponible en Phase 3.
        </p>
      </div>
    </div>
  );
}
