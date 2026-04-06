"use client";

import type { TrackerSession } from "@/lib/types";

interface SessionWithClient extends TrackerSession {
  client?: { id: string; nombre: string; programa: string };
}

interface Props {
  session: SessionWithClient | null;
  onClose: () => void;
}

export default function SessionFormModal({ session, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl w-full max-w-md p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-white font-semibold">
            {session ? `Sesion #${session.numero_sesion}` : "Nueva Sesion"}
          </h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-white text-xl">&times;</button>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {session ? `Cliente: ${session.client?.nombre ?? "---"}` : "Formulario de sesion en desarrollo"}
        </p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] text-[var(--muted)] text-sm hover:text-white transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
