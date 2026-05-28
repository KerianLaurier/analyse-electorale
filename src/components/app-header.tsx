"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bell, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { href: "/explorer", label: "Explorer" },
  { href: "/analyser", label: "Analyser" },
  { href: "/suivre", label: "Suivre" },
] as const;

export function AppHeader() {
  const pathname = usePathname();

  function openPalette() {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  }

  return (
    <header className="sticky top-0 z-40 bg-canvas/95 supports-[backdrop-filter]:bg-canvas/70 backdrop-blur">
      {/* Grid 3 colonnes : nav centrée géométriquement (justify-self-center)
         indépendamment des largeurs de gauche/droite. */}
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4">
        {/* Marque */}
        <Link
          href="/"
          className="flex items-center gap-2.5 justify-self-start transition-opacity hover:opacity-80"
        >
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"
          >
            <span className="block h-3 w-3 rounded-sm bg-primary-foreground" />
          </span>
          <span className="text-[13px] font-semibold tracking-tight">
            MOUVANCIA
          </span>
        </Link>

        {/* Nav pill centrée géométriquement */}
        <nav
          className="inline-flex items-center gap-1 justify-self-center rounded-pill bg-surface-soft/70 p-1 text-[13px] shadow-[0_0_0_1px_rgba(10,10,12,0.06)]"
          aria-label="Sections principales"
        >
          {PRIMARY_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-pill px-3.5 py-1.5 font-medium transition-all duration-200 ease-out",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(10,10,12,0.18)]"
                    : "text-foreground/70 hover:text-foreground hover:bg-surface/60",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Utilities — collés à droite */}
        <div className="flex items-center gap-1.5 justify-self-end">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Rechercher"
            title="Recherche universelle (⌘K)"
            className="grid h-8 w-8 place-items-center rounded-md text-foreground/70 transition-all duration-150 hover:bg-surface-soft hover:text-foreground active:scale-95"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="grid h-8 w-8 place-items-center rounded-md text-foreground/70 transition-all duration-150 hover:bg-surface-soft hover:text-foreground active:scale-95"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Paramètres"
            className="grid h-8 w-8 place-items-center rounded-md text-foreground/70 transition-all duration-150 hover:bg-surface-soft hover:text-foreground active:scale-95"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Profil"
            className="ml-1 grid h-8 w-8 place-items-center rounded-pill bg-warm/90 text-[12px] font-semibold text-on-dark transition-transform duration-150 hover:scale-105 active:scale-95"
          >
            K
          </button>
        </div>
      </div>
    </header>
  );
}
