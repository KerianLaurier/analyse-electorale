import Link from "next/link";
import {
  ArrowRight,
  Map as MapIcon,
  GitCompare,
  Activity,
  Layers,
  Crosshair,
  SlidersHorizontal,
  Database,
  Clock,
  ShieldCheck,
} from "lucide-react";

const STATS = [
  { value: "10", label: "scrutins · 2017 → 2026" },
  { value: "35 798", label: "communes" },
  { value: "577", label: "circonscriptions" },
  { value: "Quotidien", label: "sondages · votes AN · veille" },
];

const PILLARS = [
  {
    href: "/explorer",
    icon: MapIcon,
    kicker: "Cartographier",
    title: "Explorer",
    desc: "Carte interactive du national au bureau de vote : 10 scrutins, 4 mailles, sociologie INSEE et fiche territoire détaillée au clic.",
    points: ["Vainqueur, participation, abstention", "Présidentielles, législatives, municipales", "Revenus & pauvreté par commune"],
  },
  {
    href: "/analyser",
    icon: GitCompare,
    kicker: "Décrypter",
    title: "Analyser",
    desc: "Mesurer les mouvements : swing entre deux scrutins, corrélations socio-vote, sièges marginaux et projection législative.",
    points: ["Comparaison & bascules de blocs", "Corrélation revenu ↔ vote", "Simulateur de sièges"],
  },
  {
    href: "/suivre",
    icon: Activity,
    kicker: "Anticiper",
    title: "Suivre",
    desc: "L'actualité institutionnelle en continu : sondages de la Commission, scrutins de l'Assemblée, dossiers législatifs, agenda et veille média.",
    points: ["Sondages classés par scrutin", "Frise des lois & PPL", "Agenda électoral 2027"],
  },
];

const TOOLS = [
  { href: "/analyser/comparateur", icon: Layers, title: "Comparateur", desc: "Un territoire, tous les scrutins" },
  { href: "/analyser/marginalite", icon: Crosshair, title: "Sièges marginaux", desc: "Circonscriptions les plus disputées" },
  { href: "/analyser/simulateur", icon: SlidersHorizontal, title: "Simulateur", desc: "Projection de sièges par bloc" },
];

const TRUST = [
  { icon: Database, title: "Données ouvertes & sourcées", desc: "Ministère de l'Intérieur, INSEE, Assemblée nationale, Commission des sondages." },
  { icon: Clock, title: "Requêtes instantanées", desc: "Analyse exécutée dans le navigateur (DuckDB-WASM), sans serveur ni attente." },
  { icon: ShieldCheck, title: "Mises à jour automatiques", desc: "Sondages, scrutins et dossiers rafraîchis chaque jour." },
];

export default function HomePage() {
  return (
    <div className="flex-1 bg-canvas">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-14">
        <span className="inline-flex items-center gap-2 rounded-pill bg-warm/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-warm">
          Présidentielle & législatives 2027
        </span>
        <h1 className="mt-5 max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[56px]">
          L&apos;intelligence électorale,
          <br className="hidden sm:block" /> du national au bureau de vote.
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-[18px]">
          MOUVANCIA réunit cartographie, historique des scrutins, sociologie et simulation dans un
          seul outil. Données ouvertes, requêtes instantanées dans votre navigateur.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/explorer"
            className="inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ouvrir l&apos;explorateur
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-5 py-2.5 text-[14px] font-medium text-foreground/80 transition-colors hover:bg-surface-soft"
          >
            Se connecter
          </Link>
        </div>

        {/* Stats */}
        <div className="anim-stagger mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border/60 shadow-card sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-surface p-4">
              <p className="text-[24px] font-semibold leading-none tracking-tight tabular-nums">{s.value}</p>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Piliers */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="anim-stagger grid gap-3 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.href}
                href={p.href}
                className="group flex flex-col rounded-lg bg-surface p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(10,10,12,0.16)]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-md bg-warm/15 text-warm">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{p.kicker}</p>
                <h2 className="mt-0.5 text-[20px] font-semibold tracking-tight">{p.title}</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{p.desc}</p>
                <ul className="mt-4 flex flex-col gap-1.5">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2 text-[12.5px] text-foreground/75">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-warm" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-foreground">
                  Ouvrir
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Outils d'analyse */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Outils d&apos;analyse</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="group flex items-center gap-3 rounded-lg bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-soft"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-warm/15 text-warm">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-semibold leading-tight">{t.title}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{t.desc}</span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Confiance */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-3 sm:grid-cols-3">
          {TRUST.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.title} className="flex flex-col gap-2 rounded-lg border border-border/60 p-5">
                <Icon className="h-5 w-5 text-foreground/70" />
                <h3 className="text-[14px] font-semibold tracking-tight">{t.title}</h3>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">{t.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-5 rounded-lg bg-primary p-8 text-primary-foreground sm:flex-row sm:items-center">
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight">Prêt à explorer le terrain ?</h2>
            <p className="mt-1.5 text-[14px] text-primary-foreground/70">
              Ouvrez la carte ou demandez un accès équipe pour vos analyses 2027.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link href="/explorer" className="inline-flex items-center gap-2 rounded-pill bg-warm px-5 py-2.5 text-[14px] font-semibold text-[#0A0A0C] transition-opacity hover:opacity-90">
              Ouvrir l&apos;explorateur
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/signup" className="inline-flex items-center rounded-pill border border-primary-foreground/25 px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10">
              Demander un accès
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 pb-12 pt-4">
        <div className="flex flex-col gap-3 border-t border-border/60 pt-6 text-[11.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-foreground/80">MOUVANCIA</span>
          <span>Sources · Ministère de l&apos;Intérieur · INSEE · Assemblée nationale · Commission des sondages</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
