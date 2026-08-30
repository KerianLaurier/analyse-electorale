"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map, Megaphone, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { canEditPlan, type WsContext } from "@/app/(app)/espace/types";
import { ESPACE } from "@/app/(app)/espace/routes";

/**
 * Coquille du QG : contexte d'équipe partagé + navigation des 4 sections.
 *
 * Le contexte évite de faire redescendre `WsContext` en cascade dans une
 * quinzaine de composants ; il est alimenté une seule fois par le layout
 * serveur (`layout.tsx`), qui fait les requêtes Supabase.
 */

const WsCtx = createContext<WsContext | null>(null);

export function useWs(): WsContext {
  const ctx = useContext(WsCtx);
  if (!ctx) throw new Error("useWs doit être appelé dans <EspaceShell>");
  return ctx;
}

/** Droit de modifier le plan (cible, objectif, découpage en secteurs). */
export function useCanEditPlan(): boolean {
  return canEditPlan(useWs());
}

type Section = { href: string; label: string; hint: string; icon: typeof LayoutDashboard };

const SECTIONS: Record<"today" | "plan" | "terrain" | "equipe", Section> = {
  today: { href: ESPACE.today, label: "Aujourd’hui", hint: "Ce qui vous attend", icon: LayoutDashboard },
  plan: { href: ESPACE.plan(), label: "Le plan", hint: "Cible, objectif, secteurs", icon: Map },
  terrain: { href: ESPACE.terrain(), label: "Le terrain", hint: "Porte-à-porte, phoning, actions", icon: Megaphone },
  equipe: { href: ESPACE.equipe(), label: "L’équipe", hint: "Membres, contacts, notes", icon: Users },
};

/**
 * Ordre des sections selon le rôle. Un responsable pilote (le plan d'abord) ;
 * un membre exécute (le terrain d'abord) — c'est là que se passe l'essentiel de
 * son usage, souvent sur mobile.
 */
function sectionsFor(role: WsContext["role"]): Section[] {
  return role === "owner"
    ? [SECTIONS.today, SECTIONS.plan, SECTIONS.terrain, SECTIONS.equipe]
    : [SECTIONS.today, SECTIONS.terrain, SECTIONS.plan, SECTIONS.equipe];
}

export function EspaceShell({ ctx, children }: { ctx: WsContext; children: ReactNode }) {
  const pathname = usePathname();
  const sections = sectionsFor(ctx.role);
  // `/espace` ne doit pas s'allumer sur `/espace/plan` : correspondance exacte
  // pour la racine, préfixe pour les autres.
  const isActive = (href: string) =>
    href === ESPACE.today ? pathname === href : pathname.startsWith(href.split("?")[0]);

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      {/* Pleine largeur, sans gouttière : le QG est un poste de travail, pas un
          document. Les tableaux, la carte du porte-à-porte et le calendrier des
          permanences gagnent tout l'espace de l'écran. */}
      <header className="border-b border-border/60 px-4 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-[26px] font-semibold tracking-tight">Quartier général</h1>
          {ctx.teamName ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-warm/15 px-2.5 py-1 text-[11px] font-semibold text-warm">
              <Users className="h-3.5 w-3.5" /> {ctx.teamName}
            </span>
          ) : (
            <span className="rounded-pill bg-surface-soft px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Espace personnel
            </span>
          )}
          {!ctx.isSolo && (
            <span className="text-[11.5px] text-muted-foreground">
              {ctx.role === "owner" ? "Responsable de campagne" : "Membre de l’équipe"}
            </span>
          )}
        </div>

        {/* 4 sections — sur mobile, 4 cibles tiennent sans scroll horizontal
            (les 10 onglets précédents ne tenaient pas). */}
        <nav aria-label="Sections du QG" className="-mb-px mt-5 flex gap-1 overflow-x-auto">
          {sections.map((s) => {
            const active = isActive(s.href);
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group inline-flex min-w-max items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-warm text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-warm" : "text-muted-foreground")} />
                <span className="flex flex-col leading-tight">
                  {s.label}
                  <span className="hidden text-[10.5px] font-normal text-muted-foreground sm:block">{s.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </header>

      <WsCtx.Provider value={ctx}>
        <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">{children}</div>
      </WsCtx.Provider>
    </div>
  );
}

/**
 * Barre de vues d'une section (`?vue=`). Même mécanique partout : liens réels,
 * donc partageables et compatibles avec le bouton Retour.
 */
export function VueTabs<T extends string>({
  vues,
  current,
  href,
}: {
  vues: readonly { id: T; label: string; icon: typeof LayoutDashboard }[];
  current: T;
  href: (vue: T) => string;
}) {
  return (
    <nav
      aria-label="Vues de la section"
      className="mb-5 flex w-full items-center gap-1 overflow-x-auto rounded-pill bg-surface-soft/70 p-1 text-[13px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {vues.map((v) => {
        const active = v.id === current;
        const Icon = v.icon;
        return (
          <Link
            key={v.id}
            href={href(v.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex flex-1 min-w-max items-center justify-center gap-1.5 rounded-pill px-3 py-1.5 text-[12.5px] font-medium transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(10,10,12,0.18)]"
                : "text-foreground/70 hover:bg-surface/60 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" /> {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
