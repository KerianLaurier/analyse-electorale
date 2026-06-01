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
  Megaphone,
  DoorOpen,
  Phone,
  Users,
  Target,
  ListChecks,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/team";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: "1", title: "Analyser le terrain", desc: "Explorez les résultats du national au bureau de vote, la sociologie et les dynamiques de blocs." },
  { n: "2", title: "Cibler & planifier", desc: "Identifiez les bureaux prioritaires, définissez votre objectif de voix et bâtissez votre plan de terrain." },
  { n: "3", title: "Mobiliser l'équipe", desc: "Porte-à-porte, phoning, rôles et suivi du sentiment — tout votre QG, partagé en temps réel." },
];

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

const QG_FEATURES = [
  { icon: Target, title: "Stratégie de circonscription", desc: "Diagnostic de marginalité, rapport de force par bloc et profil sociologique de votre territoire cible." },
  { icon: ListChecks, title: "Plan de terrain", desc: "Importez les bureaux prioritaires, suivez la couverture et l'objectif de voix." },
  { icon: DoorOpen, title: "Porte-à-porte", desc: "Comptes-rendus, sondage terrain et évolution du sentiment, secteur par secteur." },
  { icon: Phone, title: "Phoning", desc: "Listes d'appels, file de contacts et résultat détaillé de chaque appel." },
  { icon: Users, title: "Équipe & rôles", desc: "Invitez vos bénévoles, attribuez des rôles (logistique, communication…), partagez tout en temps réel." },
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

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authed = !!user;

  return (
    <div className="flex-1 bg-canvas">
      {/* En-tête landing (header propre, sans navbar applicative) */}
      <header className="sticky top-0 z-40 border-b border-foreground/5 bg-canvas/80 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="block h-3 w-3 rounded-sm bg-primary-foreground" />
            </span>
            <span className="text-[13px] font-semibold tracking-tight">MOUVANCIA</span>
          </Link>
          <nav className="flex items-center gap-2">
            {authed ? (
              <Link
                href="/espace"
                className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Accéder à mon QG <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-pill px-3.5 py-2 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-surface-soft hover:text-foreground"
                >
                  Se connecter
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Essai gratuit
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
        <span className="inline-flex items-center gap-2 rounded-pill bg-warm/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-warm">
          Présidentielle & législatives 2027
        </span>
        <h1 className="mt-5 max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[56px]">
          L&apos;intelligence électorale,
          <br className="hidden sm:block" /> du national au bureau de vote.
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-[18px]">
          MOUVANCIA réunit l&apos;analyse électorale (cartographie, historique, sociologie, simulation) et le
          pilotage de campagne sur le terrain — dans un seul outil. Données ouvertes, requêtes instantanées.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {authed ? (
            <Link
              href="/espace"
              className="inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Accéder à mon QG
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Démarrer l&apos;essai gratuit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-5 py-2.5 text-[14px] font-medium text-foreground/80 transition-colors hover:bg-surface-soft"
              >
                Se connecter
              </Link>
            </>
          )}
        </div>
        <p className="mt-4 text-[12px] text-muted-foreground">
          Sans carte bancaire · données officielles · conçu pour candidats, partis & cabinets.
        </p>
          </div>
          <HeroMockup />
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

      {/* Comment ça marche */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Comment ça marche</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <span className="grid h-9 w-9 place-items-center rounded-pill bg-primary text-[14px] font-semibold text-primary-foreground">{s.n}</span>
              <h3 className="mt-3 text-[16px] font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Piliers analyse */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Analyser le terrain électoral</p>
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
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quartier général — pilotage de campagne */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-2xl border border-warm/25 bg-warm/[0.05] p-8">
          <div className="flex items-center gap-2 text-warm">
            <Megaphone className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em]">Mon QG — le cockpit de campagne</span>
          </div>
          <h2 className="mt-3 max-w-2xl text-[26px] font-semibold tracking-tight sm:text-[30px]">
            De l&apos;analyse à l&apos;action, avec votre équipe.
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Transformez vos analyses en plan d&apos;action : ciblez les bureaux, organisez le porte-à-porte
            et le phoning, suivez le sentiment de terrain et coordonnez vos bénévoles — en temps réel.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QG_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex flex-col gap-1.5 rounded-lg bg-surface p-4 shadow-card">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-warm/15 text-warm">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <h3 className="mt-1 text-[14px] font-semibold tracking-tight">{f.title}</h3>
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
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

      {/* Tarifs */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tarifs</p>
          <h2 className="mt-2 text-[26px] font-semibold tracking-tight sm:text-[30px]">Une formule pour chaque campagne</h2>
          <p className="mt-2 text-[13.5px] text-muted-foreground">Essai gratuit de 14 jours · sans carte bancaire · sans engagement.</p>
        </div>
        <div className="mt-8 grid gap-3 lg:grid-cols-3">
          {PLANS.map((p) => {
            const featured = p.id === "equipe";
            const quote = /devis/i.test(p.price);
            const href = quote
              ? "mailto:contact@mouvancia.fr?subject=Formule%20Cabinet"
              : authed
                ? "/auth/team"
                : "/auth/signup";
            const cta = quote ? "Nous contacter" : authed ? "Gérer l'abonnement" : "Démarrer l'essai gratuit";
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col rounded-2xl border p-6 shadow-card",
                  featured ? "border-warm bg-warm/[0.05] ring-1 ring-warm/30" : "border-border/60 bg-surface",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold tracking-tight">{p.name}</p>
                  {featured && <span className="rounded-pill bg-warm px-2 py-0.5 text-[10px] font-semibold text-[#0A0A0C]">Recommandé</span>}
                </div>
                <p className="mt-3 text-[28px] font-semibold tracking-tight">
                  {p.price}
                  <span className="text-[13px] font-normal text-muted-foreground">{p.period}</span>
                </p>
                <p className="text-[11.5px] text-muted-foreground">{p.seats}</p>
                <p className="mt-2 text-[13px] text-muted-foreground">{p.tagline}</p>
                <ul className="mt-4 flex flex-1 flex-col gap-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[12.5px] text-foreground/80">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={cn(
                    "mt-6 inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-2.5 text-[13px] font-medium transition-opacity hover:opacity-90",
                    featured ? "bg-primary text-primary-foreground" : "border border-border bg-surface text-foreground/80 hover:bg-surface-soft",
                  )}
                >
                  {cta}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-5 rounded-lg bg-primary p-8 text-primary-foreground sm:flex-row sm:items-center">
          <div>
            <h2 className="text-[24px] font-semibold tracking-tight">Prêt à préparer 2027 ?</h2>
            <p className="mt-1.5 text-[14px] text-primary-foreground/70">
              {authed ? "Votre QG vous attend." : "Essai gratuit, sans engagement. Données ouvertes, mises à jour quotidiennes."}
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            {authed ? (
              <Link href="/espace" className="inline-flex items-center gap-2 rounded-pill bg-warm px-5 py-2.5 text-[14px] font-semibold text-[#0A0A0C] transition-opacity hover:opacity-90">
                Accéder à mon QG
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link href="/auth/signup" className="inline-flex items-center gap-2 rounded-pill bg-warm px-5 py-2.5 text-[14px] font-semibold text-[#0A0A0C] transition-opacity hover:opacity-90">
                  Démarrer l&apos;essai gratuit
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/auth/login" className="inline-flex items-center rounded-pill border border-primary-foreground/25 px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10">
                  Se connecter
                </Link>
              </>
            )}
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

/** Aperçu produit stylisé (mockup du QG) pour le hero. */
function HeroMockup() {
  return (
    <div className="relative lg:pl-4">
      <div
        aria-hidden
        className="overflow-hidden rounded-xl border border-foreground/10 bg-surface shadow-[0_24px_60px_-24px_rgba(10,10,12,0.30)]"
      >
        {/* Chrome navigateur */}
        <div className="flex items-center gap-1.5 border-b border-foreground/5 bg-surface-soft/60 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 rounded bg-canvas px-2 py-0.5 text-[10px] text-muted-foreground">mouvancia.fr/espace</span>
        </div>
        <div className="p-4">
          {/* Objectif */}
          <div className="rounded-lg border border-warm/30 bg-warm/[0.06] p-3">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.06em] text-warm">
              <span>Objectif de campagne</span>
              <span className="font-medium normal-case text-foreground/70">8 240 / 11 134 voix</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-pill bg-surface-soft">
              <span className="block h-full w-[74%] rounded-pill bg-warm" />
            </div>
          </div>
          {/* Stats */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["Actions", "12"],
              ["Permanences", "5"],
              ["Contactées", "1 847"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-foreground/5 bg-canvas/40 p-2.5">
                <p className="text-[16px] font-semibold tabular-nums leading-none">{value}</p>
                <p className="mt-1 text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {/* Sondage terrain */}
          <div className="mt-3 rounded-lg border border-foreground/5 p-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold uppercase tracking-[0.06em] text-muted-foreground">Sondage terrain</span>
              <span className="font-semibold text-emerald-600">58 % favorables</span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-pill">
              <span className="bg-emerald-500" style={{ width: "58%" }} />
              <span className="bg-slate-400" style={{ width: "27%" }} />
              <span className="bg-red-500" style={{ width: "15%" }} />
            </div>
          </div>
          {/* Carte (esquisse) */}
          <div className="mt-3 grid grid-cols-6 gap-1">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-5 rounded-sm",
                  i % 5 === 0 ? "bg-warm/70" : i % 3 === 0 ? "bg-warm/30" : "bg-surface-soft",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
