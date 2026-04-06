"use client";

import { useEffect, useState } from "react";
import { formatUSD } from "@/lib/format";

interface Sale {
  nombre: string;
  closer: string;
  programa: string;
  monto: number;
}

export default function SaleBanner() {
  const [sale, setSale] = useState<Sale | null>(null);
  const [visible, setVisible] = useState(false);

  // Will be connected to Supabase Realtime in Phase 7
  // For now, expose a global function for testing
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__showSale = (s: Sale) => {
      setSale(s);
      setVisible(true);
      setTimeout(() => setVisible(false), 5000);
    };
  }, []);

  if (!visible || !sale) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className="bg-[var(--green)]/10 border border-[var(--green)]/30 rounded-xl p-4 backdrop-blur-sm max-w-sm">
        <p className="text-[var(--green)] font-bold text-lg">{"\u{1F680}"} Nueva Venta!</p>
        <p className="text-white">{sale.closer} cerr&oacute; a {sale.nombre}</p>
        <p className="text-[var(--muted)] text-sm">{sale.programa} — {formatUSD(sale.monto)}</p>
      </div>
    </div>
  );
}
