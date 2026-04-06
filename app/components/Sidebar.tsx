"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthSession } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function getNav(session: AuthSession): NavSection[] {
  const { is_admin, roles } = session;
  const isCloser = roles.includes("closer");
  const isSetter = roles.includes("setter");
  const isSeguimiento = roles.includes("seguimiento");

  if (is_admin) {
    const sections: NavSection[] = [
      {
        title: "PRINCIPAL",
        items: [
          { href: "/", label: "Dashboard", icon: "\u{1F4CA}" },
          { href: "/pipeline", label: "Pipeline", icon: "\u{1F4DE}" },
          { href: "/llamadas", label: "CRM Llamadas", icon: "\u{1F4CB}" },
          { href: "/tesoreria", label: "Tesorer\u00eda", icon: "\u{1F3E6}" },
        ],
      },
      {
        title: "CLIENTES",
        items: [
          { href: "/clientes", label: "Base de Clientes", icon: "\u{1F465}" },
          { href: "/seguimiento", label: "Seguimiento", icon: "\u{1F4C8}" },
          { href: "/tracker", label: "Tracker 1a1", icon: "\u{1F3AF}" },
          { href: "/renovaciones", label: "Renovaciones", icon: "\u267B\uFE0F" },
        ],
      },
      {
        title: "COBRANZAS",
        items: [
          { href: "/cobranzas", label: "Cola de Cobranzas", icon: "\u{1F4B0}" },
        ],
      },
      {
        title: "ANALYTICS",
        items: [
          { href: "/closers", label: "Closers Analytics", icon: "\u{1F3C6}" },
          { href: "/leaderboard", label: "Leaderboard", icon: "\u{1F947}" },
          { href: "/ig-metrics", label: "IG Metrics", icon: "\u{1F4F1}" },
          { href: "/reportes", label: "Reportes Diarios", icon: "\u{1F4DD}" },
        ],
      },
      {
        title: "HERRAMIENTAS",
        items: [
          { href: "/form/llamada", label: "Cargar Llamada", icon: "\u{1F4DE}" },
          { href: "/form/pago", label: "Cargar Pago", icon: "\u{1F4B3}" },
          { href: "/form/venta-chat", label: "Venta por Chat", icon: "\u{1F4AC}" },
          { href: "/form/reporte-setter", label: "Reporte Setter", icon: "\u{1F4DD}" },
          { href: "/utm", label: "UTM Builder", icon: "\u{1F517}" },
        ],
      },
      {
        title: "CONFIG",
        items: [
          { href: "/admin", label: "Admin Panel", icon: "\u2699\uFE0F" },
        ],
      },
    ];
    return sections;
  }

  if (isSeguimiento) {
    return [
      {
        title: "SEGUIMIENTO",
        items: [
          { href: "/", label: "Cola de Seguimientos", icon: "\u{1F4CB}" },
          { href: "/clientes", label: "Clientes", icon: "\u{1F465}" },
          { href: "/tracker", label: "Tracker 1a1", icon: "\u{1F3AF}" },
        ],
      },
    ];
  }

  if (isCloser && isSetter) {
    return [
      {
        title: "MI PANEL",
        items: [
          { href: "/", label: "Mi Dashboard", icon: "\u{1F4CA}" },
          { href: "/pipeline", label: "Mi Pipeline", icon: "\u{1F4DE}" },
          { href: "/leaderboard", label: "Leaderboard", icon: "\u{1F947}" },
        ],
      },
      {
        title: "ACCIONES",
        items: [
          { href: "/form/llamada", label: "Cargar Llamada", icon: "\u{1F4DE}" },
          { href: "/form/venta-chat", label: "Venta por Chat", icon: "\u{1F4AC}" },
          { href: "/form/reporte-setter", label: "Reporte Diario", icon: "\u{1F4DD}" },
        ],
      },
    ];
  }

  if (isCloser) {
    return [
      {
        title: "MI PANEL",
        items: [
          { href: "/", label: "Mi Dashboard", icon: "\u{1F4CA}" },
          { href: "/pipeline", label: "Mi Pipeline", icon: "\u{1F4DE}" },
          { href: "/leaderboard", label: "Leaderboard", icon: "\u{1F947}" },
        ],
      },
      {
        title: "ACCIONES",
        items: [
          { href: "/form/llamada", label: "Cargar Llamada", icon: "\u{1F4DE}" },
        ],
      },
    ];
  }

  // Setter only
  return [
    {
      title: "MI PANEL",
      items: [
        { href: "/", label: "Mi Dashboard", icon: "\u{1F4CA}" },
        { href: "/leaderboard", label: "Leaderboard", icon: "\u{1F947}" },
      ],
    },
    {
      title: "ACCIONES",
      items: [
        { href: "/form/venta-chat", label: "Venta por Chat", icon: "\u{1F4AC}" },
        { href: "/form/reporte-setter", label: "Reporte Diario", icon: "\u{1F4DD}" },
      ],
    },
  ];
}

export default function Sidebar({ session }: { session: AuthSession }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = getNav(session);

  useEffect(() => { setOpen(false); }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[var(--card-bg)] border-b border-[var(--card-border)] flex items-center justify-between px-4 z-40">
        <button onClick={() => setOpen(true)} className="text-white text-xl">{"\u2630"}</button>
        <span className="text-white font-semibold">Lauti CRM</span>
        <div className="w-6" />
      </div>

      {/* Overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-50" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-[var(--card-bg)] border-r border-[var(--card-border)] z-50 transition-transform duration-200 ${
        open ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 overflow-y-auto`}>
        <div className="p-4 border-b border-[var(--card-border)]">
          <h2 className="text-lg font-bold text-white">Lauti CRM</h2>
          <p className="text-xs text-[var(--muted)]">{session.nombre} — {session.roles.join(", ")}</p>
        </div>

        <nav className="p-2">
          {nav.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-3 py-1 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                {section.title}
              </p>
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-[var(--purple)]/15 text-[var(--purple-light)] font-medium"
                        : "text-[var(--muted)] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--card-border)] mt-auto">
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-[var(--muted)] hover:text-[var(--red)] transition-colors"
          >
            {"\u{1F6AA}"} Salir
          </button>
        </div>
      </aside>
    </>
  );
}
