"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TEAM = [
  { nombre: "Lauti", emoji: "\u{1F451}" },
  { nombre: "Mel", emoji: "\u{1F4B0}" },
  { nombre: "Juanma", emoji: "\u{1F4CA}" },
  { nombre: "Iv\u00e1n", emoji: "\u{1F4DE}" },
  { nombre: "Joaqu\u00edn", emoji: "\u{1F4AC}" },
  { nombre: "Jorge", emoji: "\u{1F504}" },
  { nombre: "Pepito", emoji: "\u{1F4CB}" },
];

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!selected || pin.length !== 4) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: selected, pin }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Error al iniciar sesi\u00f3n");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Lauti CRM</h1>
          <p className="text-[var(--muted)] mt-1">Seleccion\u00e1 tu usuario</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {TEAM.map((t) => (
            <button
              key={t.nombre}
              onClick={() => { setSelected(t.nombre); setPin(""); setError(""); }}
              className={`p-3 rounded-lg border text-left transition-all ${
                selected === t.nombre
                  ? "border-[var(--purple)] bg-[var(--purple)]/10 text-white"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted)] hover:border-[var(--purple)]/50"
              }`}
            >
              <span className="text-lg">{t.emoji}</span>{" "}
              <span className="font-medium">{t.nombre}</span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN (4 d\u00edgitos)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-white text-center text-2xl tracking-[0.5em] focus:border-[var(--purple)] outline-none"
              autoFocus
            />
            {error && <p className="text-[var(--red)] text-sm text-center">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={pin.length !== 4 || loading}
              className="w-full p-3 rounded-lg bg-[var(--purple)] text-white font-semibold disabled:opacity-50 hover:bg-[var(--purple-dark)] transition-colors"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
