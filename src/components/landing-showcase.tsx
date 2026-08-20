"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Map as MapIcon,
  Megaphone,
  Check,
} from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";

const DISPLAY = "[font-family:var(--font-display)]";

type TabId = "explorer" | "campagne";

const TABS: {
  id: TabId;
  icon: typeof MapIcon;
  tab: string;
  kicker: string;
  title: string;
  desc: string;
  features: string[];
  cta: string;
  href: (authed: boolean) => string;
}[] = [
  {
    id: "explorer",
    icon: MapIcon,
    tab: "Explorer & analyser",
    kicker: "Comprendre le terrain",
    title: "L’intelligence électorale, du national au bureau de vote.",
    desc: "Cartographie interactive, historique multi-scrutins, sociologie INSEE et analyse prédictive. Comprenez n’importe quel territoire en quelques clics.",
    features: [
      "Carte du national au bureau de vote — 4 mailles, 10 scrutins",
      "Diagnostic territorial : rapport de force, marginalité, dynamiques",
      "Sociologie INSEE croisée au vote (revenus, CSP, âge…)",
      "Analyse prédictive : projections et potentiel par bloc",
      "Comparateur, sièges marginaux et simulateur de sièges",
    ],
    cta: "Explorer la carte",
    href: () => "/explorer",
  },
  {
    id: "campagne",
    icon: Megaphone,
    tab: "Piloter la campagne",
    kicker: "Agir sur le terrain",
    title: "Votre QG de campagne, du plan de terrain au porte-à-porte.",
    desc: "Transformez l’analyse en action : objectif de voix chiffré, secteurs prioritaires, porte-à-porte et phoning — le tout partagé avec votre équipe en temps réel.",
    features: [
      "Objectif de voix chiffré et suivi de la couverture",
      "Plan de terrain : bureaux prioritaires, secteurs, statut",
      "Porte-à-porte & phoning avec sentiment de terrain",
      "Contacts, bénévoles, rôles et créneaux",
      "Tout partagé, en temps réel, avec votre équipe",
    ],
    cta: "Créer mon QG",
    href: (authed) => (authed ? "/espace" : "/auth/signup"),
  },
];

/**
 * Vitrine produit à onglets : dissocie clairement les deux métiers de la
 * plateforme — intelligence électorale et pilotage de campagne.
 * Chaque onglet = un bénéfice, une liste de fonctionnalités, un aperçu et un CTA.
 */
export function LandingShowcase({ authed }: { authed: boolean }) {
  const [active, setActive] = useState<TabId>("explorer");
  const base = useId();
  const current = TABS.find((t) => t.id === active) ?? TABS[0];
  const Icon = current.icon;

  return (
    <div>
      {/* Barre d'onglets */}
      <div
        role="tablist"
        aria-label="Fonctionnalités de la plateforme"
        className="flex flex-wrap gap-1.5 rounded-pill border border-border bg-surface/60 p-1.5"
      >
        {TABS.map((t) => {
          const on = t.id === active;
          const TIcon = t.icon;
          return (
            <Button
              key={t.id}
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const i = TABS.findIndex((x) => x.id === active);
                const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
                setActive(TABS[next].id);
                document.getElementById(`${base}-tab-${TABS[next].id}`)?.focus();
              }}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-pill px-3.5 py-2.5 text-[13px] font-semibold transition-colors sm:flex-none sm:text-[13.5px]",
                on
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "text-foreground/65 hover:bg-surface hover:text-foreground",
              )} variant="ghost" size="sm">
              <TIcon className="h-4 w-4" />
              {t.tab}
            </Button>
          );
        })}
      </div>

      {/* Panneau actif */}
      <div
        role="tabpanel"
        id={`${base}-panel-${current.id}`}
        aria-labelledby={`${base}-tab-${current.id}`}
        className="mt-8 grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14"
      >
        <div key={current.id} className="anim-fade-in">
          <div className="flex items-center gap-2 text-warm">
            <Icon className="h-[18px] w-[18px]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em]">{current.kicker}</span>
          </div>
          <h3 className={cn(DISPLAY, "mt-3 max-w-[18ch] text-[clamp(1.5rem,3vw,2.15rem)] font-extrabold leading-[1.06] tracking-[-0.02em]")}>
            {current.title}
          </h3>
          <p className="mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-muted-foreground">
            {current.desc}
          </p>
          <ul className="mt-6 flex flex-col gap-2.5">
            {current.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-foreground/85">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-warm/15 text-warm">
                  <Check className="h-3 w-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href={current.href(authed)}
            className="mt-8 inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:opacity-95"
          >
            {current.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Aperçu produit par onglet */}
        <div key={`${current.id}-mock`} className="anim-fade-in">
          {active === "explorer" && <ExplorerMock />}
          {active === "campagne" && <CampagneMock />}
        </div>
      </div>
    </div>
  );
}

// ─── Aperçus (mockups CSS, purement décoratifs) ──────────────────────────────

function MockFrame({ url, tag, children }: { url: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-floating">
      <div className="flex items-center gap-1.5 border-b border-border/70 bg-surface-soft/50 px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-bloc-red/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warm/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
        <span className="ml-2 rounded bg-canvas px-2 py-0.5 text-[10px] text-muted-foreground">{url}</span>
        <span className="ml-auto text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">{tag}</span>
      </div>
      {children}
    </div>
  );
}

/** Carte choroplèthe stylisée (grille de cellules teintées) + panneau projection. */
function ExplorerMock() {
  // Intensités par « territoire » (fractions), teintées vers un bloc dominant.
  const cells = [
    2, 3, 3, 1, 0, 3, 3, 2, 1, 0,
    1, 3, 2, 2, 1, 3, 2, 1, 0, 1,
    0, 2, 3, 3, 2, 1, 0, 2, 1, 0,
    1, 1, 2, 3, 3, 2, 1, 0, 1, 2,
    0, 0, 1, 2, 3, 3, 2, 1, 2, 3,
    1, 0, 0, 1, 2, 2, 3, 3, 2, 1,
  ];
  const tint = ["var(--surface-soft)", "color-mix(in srgb, var(--bloc-navy) 22%, transparent)", "color-mix(in srgb, var(--bloc-navy) 48%, transparent)", "color-mix(in srgb, var(--bloc-navy) 78%, transparent)"];
  const proj = [
    { label: "RN / ext. droite", pct: 33, color: "var(--bloc-navy)" },
    { label: "Gauche / NFP", pct: 28, color: "var(--bloc-red)" },
    { label: "Centre", pct: 21, color: "var(--warm)" },
    { label: "Droite (LR)", pct: 12, color: "#1e40af" },
  ];
  return (
    <MockFrame url="mouvancia.fr/explorer" tag="Prés. 2022 · T1">
      <div className="grid gap-3 p-4 sm:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Part du bloc · par commune</p>
          <div className="grid grid-cols-10 gap-1 overflow-hidden rounded-lg">
            {cells.map((c, i) => (
              <span key={i} className="aspect-square rounded-[3px]" style={{ background: tint[c] }} />
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[9px] text-muted-foreground">
            <span>Faible</span>
            <span className="h-1.5 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, var(--surface-soft), var(--bloc-navy))" }} />
            <span>Fort</span>
          </div>
        </div>
        <div className="rounded-xl border border-border/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Projection 2027</p>
          <div className="mt-2.5 space-y-2.5">
            {proj.map((p) => (
              <div key={p.label}>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="truncate text-foreground/70">{p.label}</span>
                  <span className="font-semibold tabular-nums">{p.pct}%</span>
                </div>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-pill bg-surface-soft">
                  <span className="block h-full rounded-pill" style={{ width: `${p.pct * 2.4}%`, background: p.color }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/** Aperçu QG : objectif de voix, secteurs prioritaires, sentiment terrain. */
function CampagneMock() {
  const sectors = [
    { name: "Bureau 12 · centre", prio: "Prioritaire", tone: "bg-bloc-red/15 text-bloc-red" },
    { name: "Bureau 07 · gare", prio: "À couvrir", tone: "bg-warm/15 text-warm" },
    { name: "Bureau 21 · nord", prio: "Couvert", tone: "bg-success/15 text-success" },
  ];
  return (
    <MockFrame url="mouvancia.fr/espace" tag="Lég. 2024 · T2">
      <div className="space-y-3 p-4">
        <div className="rounded-xl border border-warm/30 bg-warm/[0.07] p-3.5">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.06em] text-warm">
            <span>Objectif de campagne</span>
            <span className="font-bold normal-case tabular-nums text-foreground/75">8 240 / 11 134 voix</span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-pill bg-surface-soft">
            <span className="block h-full rounded-pill bg-warm" style={{ width: "74%" }} />
          </div>
        </div>
        <div className="rounded-xl border border-border/70 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Plan de terrain</p>
          <ul className="mt-2.5 space-y-2">
            {sectors.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-[11.5px]">
                <span className="min-w-0 flex-1 truncate text-foreground/75">{s.name}</span>
                <span className={cn("rounded-pill px-2 py-0.5 text-[9.5px] font-semibold", s.tone)}>{s.prio}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/70 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Porte-à-porte</p>
            <p className={cn(DISPLAY, "mt-1 text-[19px] font-bold leading-none tabular-nums")}>342 <span className="text-[11px] font-medium text-muted-foreground">portes</span></p>
          </div>
          <div className="rounded-xl border border-border/70 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Sentiment terrain</p>
            <p className={cn(DISPLAY, "mt-1 text-[19px] font-bold leading-none tabular-nums text-success")}>58 % fav.</p>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

