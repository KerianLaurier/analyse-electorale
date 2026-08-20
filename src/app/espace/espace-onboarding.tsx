"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Rocket, X, Lock } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import type { WsContext } from "@/app/espace/types";
import type { Tab } from "@/app/espace/espace-view";
import type { Campaign, Sector } from "@/lib/campaign";

const DISMISS_KEY = "mvc:onboarding:dismissed";

type Step = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  /** Verrouillé tant qu'une équipe n'existe pas. */
  locked?: boolean;
  href?: string;
  onClick?: () => void;
};

/**
 * Checklist de prise en main, affichée sur la Vue d'ensemble tant que la
 * configuration de campagne est incomplète. Disparaît une fois les étapes clés
 * faites (ou si l'utilisateur la masque).
 */
export function EspaceOnboarding({
  ctx,
  campaign,
  sectors,
  goal,
  setTab,
}: {
  ctx: WsContext;
  campaign: Campaign | null;
  sectors: Sector[];
  goal: number | null;
  setTab: (t: Tab) => void;
}) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );

  const hasTeam = !!ctx.teamId;

  const steps: Step[] = [
    {
      id: "team",
      label: "Créer ou rejoindre une équipe",
      hint: "Tout le QG se partage au niveau de l'équipe.",
      done: hasTeam,
      href: "/auth/team",
    },
    {
      id: "target",
      label: "Définir ma circonscription cible",
      hint: "Le territoire sur lequel se concentre la campagne.",
      done: !!campaign?.target,
      locked: !hasTeam,
      onClick: () => setTab("campaign"),
    },
    {
      id: "goal",
      label: "Fixer mon objectif de voix",
      hint: "Inscrits, participation et score visés.",
      done: goal != null,
      locked: !hasTeam,
      onClick: () => setTab("campaign"),
    },
    {
      id: "plan",
      label: "Bâtir mon plan de terrain",
      hint: "Importer les bureaux prioritaires à travailler.",
      done: sectors.length > 0,
      locked: !hasTeam,
      onClick: () => setTab("campaign"),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (allDone || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* quota / indispo */
    }
    setDismissed(true);
  }

  // Première étape actionnable (non faite, non verrouillée) → mise en avant.
  const nextId = steps.find((s) => !s.done && !s.locked)?.id ?? null;

  return (
    <section className="rounded-lg border border-warm/30 bg-warm/[0.06] p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-warm/15 text-warm">
            <Rocket className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold tracking-tight">Prise en main de votre QG</p>
            <p className="text-[11.5px] text-muted-foreground">
              {doneCount} / {steps.length} étape{doneCount > 1 ? "s" : ""} · configurez votre campagne en quelques minutes
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={dismiss}
          aria-label="Masquer la prise en main"
          className="h-6 w-6 shrink-0 rounded" variant="soft" size="icon-sm">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-pill bg-surface-soft/70">
        <span className="block h-full rounded-pill bg-warm transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ul className="mt-3 flex flex-col divide-y divide-warm/15">
        {steps.map((s) => {
          const isNext = s.id === nextId;
          return (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]",
                  s.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : s.locked
                      ? "border-border text-muted-foreground"
                      : "border-warm text-warm",
                )}
              >
                {s.done ? <Check className="h-3 w-3" /> : s.locked ? <Lock className="h-2.5 w-2.5" /> : ""}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px] font-medium", s.done && "text-muted-foreground line-through")}>{s.label}</p>
                {!s.done && <p className="text-[11.5px] text-muted-foreground">{s.hint}</p>}
              </div>
              {!s.done && !s.locked && <StepCta step={s} highlight={isNext} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StepCta({ step, highlight }: { step: Step; highlight: boolean }) {
  const className = cn(
    "inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
    highlight
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "bg-foreground/[0.04] text-foreground/80 hover:bg-foreground/[0.08]",
  );
  const content = (
    <>
      Commencer <ArrowRight className="h-3.5 w-3.5" />
    </>
  );
  if (step.href) {
    return (
      <Link href={step.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <Button type="button" onClick={step.onClick} className={className} variant="ghost" size="sm">
      {content}
    </Button>
  );
}
