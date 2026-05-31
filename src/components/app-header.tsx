"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, Bell, Settings2, LogOut, Users, Star, ListTodo, CalendarClock, Target, CheckCheck, X, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useNotifications, dismissNotification, dismissAll, type AppNotification } from "@/lib/notifications";
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

const NO_CHROME = new Set(["/auth/login", "/auth/signup", "/auth/abonnement", "/auth/forgot", "/auth/reset"]);

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const notifs = useNotifications(userId);

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
          <NotificationsBell
            notifs={notifs}
            onOpen={(href) => router.push(href)}
          />
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
              <DropdownMenuItem onSelect={() => router.push("/auth/reset")}>
                <KeyRound className="h-4 w-4" />
                Changer le mot de passe
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

const NOTIF_ICON = {
  task: ListTodo,
  shift: CalendarClock,
  campaign: Target,
} as const;
const NOTIF_TONE = {
  warn: "text-red-600",
  info: "text-warm",
  success: "text-emerald-600",
} as const;

function NotificationsBell({
  notifs,
  onOpen,
}: {
  notifs: AppNotification[];
  onOpen: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const count = notifs.length;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
        className="relative grid h-8 w-8 place-items-center rounded-md text-foreground/70 outline-none transition-all duration-150 hover:bg-surface-soft hover:text-foreground active:scale-95"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-black/10 bg-surface shadow-[0_8px_30px_rgba(10,10,12,0.18)]">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[12px] font-semibold">Notifications</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => dismissAll(notifs.map((n) => n.id))}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Tout lire
              </button>
            )}
          </div>
          <div className="h-px bg-border" />
          {count === 0 ? (
            <p className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">Aucune notification</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto p-1">
              {notifs.map((n) => {
                const Icon = NOTIF_ICON[n.kind];
                return (
                  <div key={n.id} className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-surface-soft">
                    <button
                      type="button"
                      onClick={() => { onOpen(n.href); setOpen(false); }}
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", NOTIF_TONE[n.tone])} />
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium leading-snug">{n.title}</span>
                        {n.detail && <span className="block truncate text-[11px] text-muted-foreground">{n.detail}</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissNotification(n.id)}
                      aria-label="Marquer comme lu"
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
