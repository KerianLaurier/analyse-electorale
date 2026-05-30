"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Bell, Settings2, LogOut, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const PRIMARY_NAV = [
  { href: "/explorer", label: "Explorer" },
  { href: "/analyser", label: "Analyser" },
  { href: "/suivre", label: "Suivre" },
] as const;

const NO_CHROME = new Set(["/auth/login", "/auth/signup", "/auth/abonnement"]);

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  // Écrans d'authentification : pas de chrome applicatif.
  // (la page équipe /auth/team garde le chrome : c'est un réglage in-app)
  if (NO_CHROME.has(pathname)) return null;

  const initial = (email?.[0] ?? "K").toUpperCase();

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
          <Link
            href="/espace"
            aria-label="Mes épingles"
            title="Mes épingles"
            className="grid h-8 w-8 place-items-center rounded-md text-foreground/70 transition-all duration-150 hover:bg-surface-soft hover:text-foreground active:scale-95"
          >
            <Star className="h-4 w-4" />
          </Link>
          <button
            type="button"
            aria-label="Notifications"
            className="grid h-8 w-8 place-items-center rounded-md text-foreground/70 transition-all duration-150 hover:bg-surface-soft hover:text-foreground active:scale-95"
          >
            <Bell className="h-4 w-4" />
          </button>
          <Link
            href="/auth/team"
            aria-label="Paramètres de l'équipe"
            title="Équipe & abonnement"
            className="grid h-8 w-8 place-items-center rounded-md text-foreground/70 transition-all duration-150 hover:bg-surface-soft hover:text-foreground active:scale-95"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Compte"
              className="ml-1 grid h-8 w-8 place-items-center rounded-pill bg-warm/90 text-[12px] font-semibold text-on-dark transition-transform duration-150 hover:scale-105 active:scale-95"
            >
              {initial}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{email ?? "Compte"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/espace")}>
                <Star className="h-4 w-4" />
                Mes épingles
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/auth/team")}>
                <Users className="h-4 w-4" />
                Équipe & abonnement
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
