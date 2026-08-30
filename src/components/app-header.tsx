"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Bell, Settings2, LogOut, Users, Star, ListTodo, CalendarClock, Target, CheckCheck, X, KeyRound, ShieldCheck, Megaphone, UserRound, Sparkles, MonitorDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESPACE } from "@/app/(app)/espace/routes";
import { BrandMark } from "@/components/brand-mark";
import { createClient } from "@/lib/supabase/client";
import { getIdentity, onIdentityChange } from "@/lib/identity";
import { canPromptInstall, onInstallChange, promptInstall } from "@/lib/pwa-install";
import { initials } from "@/lib/team";
import { useNotifications, dismissNotification, dismissAll, type AppNotification } from "@/lib/notifications";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@appica/ui-react/button";
import { Badge } from "@appica/ui-react/badge";
import { Navigation, NavigationList, NavigationItem } from "@appica/ui-react/navigation";
import { NavigationLink } from "@appica/ui-react/navigation";
import { Popover, PopoverTrigger, PopoverContent } from "@appica/ui-react/popover";
import { Separator } from "@appica/ui-react/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuSeparator,
} from "@appica/ui-react/dropdown-menu";

const PRIMARY_NAV = [
  { href: "/explorer", label: "Explorer" },
  { href: "/analyser", label: "Analyser" },
  { href: "/espace", label: "Mon QG" },
] as const;

// Zone tactile étendue (~44 px, WCAG 2.5.8) sans grossir le rendu : le
// pseudo-élément capte les taps autour de l'élément. Extension verticale
// seulement — l'horizontale ferait se chevaucher des cibles voisines.
const HIT_AREA = "relative before:absolute before:-inset-y-1.5 before:-inset-x-0.5 before:content-['']";

// Pages sans chrome applicatif : écrans d'auth et secours hors-ligne, qui
// possèdent leur propre en-tête.
//
// La vitrine (`/`, pages légales) n'a plus besoin d'y figurer : elle vit dans
// le groupe de routes `(vitrine)`, dont le layout ne monte tout simplement pas
// ce composant (cf. src/app/(vitrine)/layout.tsx). Elle ne télécharge donc plus
// son JavaScript, là où ce garde-fou se contentait de masquer le rendu.
const NO_CHROME = new Set(["/auth/login", "/auth/signup", "/auth/abonnement", "/auth/forgot", "/auth/reset", "/offline"]);

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    async function sync() {
      // Identité partagée (résolue une seule fois pour toute l'app) : pas de
      // getUser réseau ni de requête profiles propre au header.
      const id = await getIdentity();
      if (!alive) return;
      setEmail(id.email);
      setFullName(id.fullName);
      setUserId(id.userId);
      setIsSuperAdmin(id.isSuperAdmin);
    }
    void sync();
    const off = onIdentityChange(() => void sync());
    return () => {
      alive = false;
      off();
    };
  }, []);

  const notifs = useNotifications(userId);

  // Installation PWA : l'item n'apparaît que si le navigateur la propose
  // (beforeinstallprompt capté par <Pwa /> au chargement).
  const [installable, setInstallable] = useState(false);
  useEffect(() => {
    const sync = () => setInstallable(canPromptInstall());
    const off = onInstallChange(sync);
    sync();
    return off;
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  // Écrans d'authentification : pas de chrome applicatif.
  // (la page équipe /auth/team garde le chrome : c'est un réglage in-app)
  if (NO_CHROME.has(pathname)) return null;

  const avatarInitials = initials(fullName ?? "", email ?? "");
  const displayName = fullName?.trim() || email;

  function openPalette() {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  }

  // Section active : `/analyser/simulateur` doit allumer « Analyser ».
  const activeHref =
    PRIMARY_NAV.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.href ?? null;

  // Nav pill d'Appica : c'est lui qui pose `aria-current="page"` sur le lien dont
  // le `value` correspond à `activeLink`, et qui porte les états actif/survol.
  const navLinks = PRIMARY_NAV.map((item) => (
    <NavigationItem key={item.href}>
      <NavigationLink
        value={item.href}
        className={cn(
          // ⚠ Appica pose rayon et paddings DERRIÈRE le préfixe
          // `data-[orientation=horizontal]:` (rounded-sm px-3 py-2 en taille sm).
          // Deux conditions pour les remplacer, sinon l'onglet actif ressort en
          // rectangle : reprendre le MÊME préfixe (tailwind-merge compare les
          // modificateurs), et utiliser `rounded-full` plutôt que notre
          // `rounded-pill` — `pill` est une clé maison que le tailwind-merge
          // interne d'Appica ne rattache pas au groupe « border-radius », donc
          // il ne déduplique pas. Rendu identique (999px vs 9999px).
          "font-medium",
          "data-[orientation=horizontal]:rounded-full",
          "data-[orientation=horizontal]:px-3.5 data-[orientation=horizontal]:py-1.5",
          // Section active : pilule noire MOUVANCIA. La variante `pill`
          // d'Appica se contente d'un fond `background-muted` très discret —
          // trop faible pour signaler la section courante dans cette identité.
          "data-active:bg-primary data-active:text-primary-foreground",
          "data-active:shadow-[0_1px_2px_rgba(10,10,12,0.18)] data-active:before:bg-transparent",
          // Zone tactile étendue verticalement (WCAG 2.5.8) sans grossir le rendu.
          "after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']",
        )}
        render={<Link href={item.href} />}
      >
        {item.label}
      </NavigationLink>
    </NavigationItem>
  ));

  return (
    <>
    <header className="sticky top-0 z-40 bg-canvas/95 supports-[backdrop-filter]:bg-canvas/70 backdrop-blur">
      {/* Desktop : grille 3 colonnes (nav centrée en haut). Mobile : logo +
         utilitaires seulement — la navigation est en bas (ergonomie pouce). */}
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        {/* Marque */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80 lg:justify-self-start"
        >
          <BrandMark tileClassName="h-8 w-8 rounded-md" svgClassName="h-5 w-5" />
          <span className="text-[13px] font-semibold tracking-tight">MOUVANCIA</span>
        </Link>

        {/* Nav pill (desktop, en haut au centre) */}
        <Navigation
          variant="pill"
          size="sm"
          activeLink={activeHref}
          aria-label="Sections principales"
          className="hidden rounded-pill bg-surface-soft/70 p-1 text-[13px] shadow-[0_0_0_1px_rgba(10,10,12,0.06)] lg:block lg:justify-self-center"
        >
          <NavigationList className="gap-1">{navLinks}</NavigationList>
        </Navigation>

        {/* Utilities — sur mobile : recherche + notifications + compte (les
           raccourcis épingles/réglages restent dans le menu compte). */}
        <div className="flex shrink-0 items-center gap-1.5 lg:justify-self-end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={openPalette}
            aria-label="Rechercher"
            title="Recherche universelle (⌘K)"
            className={cn("active:scale-95", HIT_AREA)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mes épingles"
            title="Mes épingles"
            nativeButton={false}
            className={cn("hidden active:scale-95 sm:inline-flex", HIT_AREA)}
            render={<Link href={ESPACE.plan("epingles")} />}
          >
            <Star className="h-4 w-4" />
          </Button>
          <NotificationsBell
            notifs={notifs}
            onOpen={(href) => router.push(href)}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Paramètres de l'équipe"
            title="Équipe & abonnement"
            nativeButton={false}
            className={cn("hidden active:scale-95 sm:inline-flex", HIT_AREA)}
            render={<Link href="/auth/team" />}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Compte"
              className={cn("ml-1 grid h-8 w-8 place-items-center rounded-pill bg-warm/90 text-[11px] font-semibold text-on-dark transition-transform duration-150 hover:scale-105 active:scale-95", HIT_AREA)}
            >
              {avatarInitials}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuGroupLabel className="flex flex-col">
                  <span className="truncate font-semibold">{displayName ?? "Compte"}</span>
                  {fullName && email && <span className="truncate text-[11px] font-normal text-muted-foreground">{email}</span>}
                </DropdownMenuGroupLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/auth/team")}>
                <UserRound className="h-4 w-4" />
                Mon compte
              </DropdownMenuItem>
              {isSuperAdmin && (
                <DropdownMenuItem onClick={() => router.push("/admin")}>
                  <ShieldCheck className="h-4 w-4" />
                  Back-office
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push("/espace")}>
                <Megaphone className="h-4 w-4" />
                Mon QG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(ESPACE.plan("epingles"))}>
                <Star className="h-4 w-4" />
                Mes épingles
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/auth/team")}>
                <Users className="h-4 w-4" />
                Équipe & abonnement
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/bienvenue")}>
                <Sparkles className="h-4 w-4" />
                Prise en main
              </DropdownMenuItem>
              {installable && (
                <DropdownMenuItem onClick={() => void promptInstall()}>
                  <MonitorDown className="h-4 w-4" />
                  Installer l&apos;application
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push("/auth/reset")}>
                <KeyRound className="h-4 w-4" />
                Changer le mot de passe
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="mb-1.5 px-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Apparence</p>
                <ThemeSwitch />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

      {/* Navigation pill EN BAS sur mobile (même design que desktop, ergonomie
         pouce). Flottante au-dessus de la zone sûre. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pt-2 lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
      >
        <Navigation
          variant="pill"
          size="sm"
          activeLink={activeHref}
          aria-label="Sections principales"
          className="pointer-events-auto rounded-pill bg-surface/95 p-1 text-[13px] shadow-floating ring-1 ring-foreground/10 backdrop-blur"
        >
          <NavigationList className="gap-1">{navLinks}</NavigationList>
        </Navigation>
      </div>
    </>
  );
}

const NOTIF_ICON = {
  task: ListTodo,
  shift: CalendarClock,
  campaign: Target,
} as const;
const NOTIF_TONE = {
  warn: "text-destructive",
  info: "text-warm",
  success: "text-success",
} as const;

function NotificationsBell({
  notifs,
  onOpen,
}: {
  notifs: AppNotification[];
  onOpen: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = notifs.length;

  return (
    // Popover d'Appica : il porte le clic-extérieur, l'échappement, le
    // positionnement et le piège de focus — trois écouteurs `document` posés à
    // la main en moins, et le même comportement que les autres surfaces
    // flottantes de l'app.
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
        className={cn(
          "relative grid h-8 w-8 place-items-center rounded-md text-foreground/70 outline-none",
          "transition-all duration-150 hover:bg-surface-soft hover:text-foreground active:scale-95",
          HIT_AREA,
        )}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <Badge
            variant="error"
            size="xs"
            className="absolute -right-0.5 -top-0.5 min-w-4 justify-center rounded-full px-1 text-[9px]"
          >
            {count > 9 ? "9+" : count}
          </Badge>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 overflow-hidden p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[12px] font-semibold">Notifications</span>
          {count > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => dismissAll(notifs.map((n) => n.id))}
              className="gap-1 text-[11px]"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tout lire
            </Button>
          )}
        </div>
        <Separator />
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => dismissNotification(n.id)}
                    aria-label="Marquer comme lu"
                    className="mt-0.5 h-6 w-6 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
