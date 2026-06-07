import Link from "next/link";
import { Archivo, Public_Sans } from "next/font/google";
import {
  ArrowRight,
  ArrowUpRight,
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
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/team";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { LandingDeck } from "@/components/landing-deck";
import { LandingStats } from "@/components/landing-stats";
import { LandingZoom } from "@/components/landing-zoom";

// Typographie scopée à la landing : Archivo (display affirmé, grotesque
// éditorial) + Public Sans (corps institutionnel, lignée USWDS). Volontairement
// hors de la fonte applicative (Geist) pour donner une signature à la page
// publique sans toucher au reste de l'app.
const display = Archivo({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
  display: "swap",
});
const body = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const DISPLAY = "[font-family:var(--font-display)]";

const STEPS = [
  { n: "01", title: "Analyser le terrain", desc: "Du résultat national au bureau de vote : sociologie, historique multi-scrutins et dynamiques de blocs, en un clic." },
  { n: "02", title: "Cibler & planifier", desc: "Repérez les bureaux prioritaires, fixez votre objectif de voix et bâtissez un plan de terrain chiffré." },
  { n: "03", title: "Mobiliser l'équipe", desc: "Porte-à-porte, phoning, rôles et sentiment de terrain. Votre QG entier, partagé en temps réel." },
];

const PILLARS = [
  {
    href: "/explorer",
    index: "01",
    icon: MapIcon,
    kicker: "Cartographier",
    title: "Explorer",
    desc: "Carte interactive du national au bureau de vote : 10 scrutins, 4 mailles, sociologie INSEE et fiche territoire détaillée au clic.",
    points: ["Vainqueur · participation · abstention", "Présidentielles, législatives, municipales", "Revenus & pauvreté par commune"],
  },
  {
    href: "/analyser",
    index: "02",
    icon: GitCompare,
    kicker: "Décrypter",
    title: "Analyser",
    desc: "Mesurer les mouvements : swing entre deux scrutins, corrélations socio-vote, sièges marginaux et projection législative.",
    points: ["Comparaison & bascules de blocs", "Corrélation revenu ↔ vote", "Simulateur de sièges"],
  },
  {
    href: "/suivre",
    index: "03",
    icon: Activity,
    kicker: "Anticiper",
    title: "Suivre",
    desc: "L'actualité institutionnelle en continu : sondages de la Commission, scrutins de l'Assemblée, dossiers législatifs, agenda et veille.",
    points: ["Sondages classés par scrutin", "Frise des lois & PPL", "Agenda électoral 2027"],
  },
];

const QG_FEATURES = [
  { icon: Target, title: "Stratégie de circonscription", desc: "Diagnostic de marginalité, rapport de force par bloc et profil sociologique de votre territoire cible." },
  { icon: ListChecks, title: "Plan de terrain", desc: "Importez les bureaux prioritaires, suivez la couverture et l'objectif de voix." },
  { icon: DoorOpen, title: "Porte-à-porte", desc: "Comptes-rendus, sondage terrain et évolution du sentiment, secteur par secteur." },
  { icon: Phone, title: "Phoning", desc: "Listes d'appels, file de contacts et résultat détaillé de chaque appel." },
  { icon: Users, title: "Équipe & rôles", desc: "Invitez vos bénévoles, attribuez des rôles et partagez tout en temps réel." },
];

const TOOLS = [
  { href: "/analyser/comparateur", icon: Layers, title: "Comparateur", desc: "Un territoire, tous les scrutins" },
  { href: "/analyser/marginalite", icon: Crosshair, title: "Sièges marginaux", desc: "Circonscriptions les plus disputées" },
  { href: "/analyser/simulateur", icon: SlidersHorizontal, title: "Simulateur", desc: "Projection de sièges par bloc" },
];

const SOURCES = [
  "Ministère de l'Intérieur",
  "INSEE",
  "Assemblée nationale",
  "data.gouv.fr",
  "Commission des sondages",
];

const FAQ = [
  {
    q: "Les données personnelles des électeurs sont-elles utilisées ?",
    a: "Non. MOUVANCIA n'exploite que des agrégats publics (résultats par bureau de vote, indicateurs INSEE par commune). Aucune donnée nominative d'électeur n'est collectée ni stockée. Vos données de campagne, elles, restent privées et sécurisées.",
  },
  {
    q: "L'outil est-il neutre politiquement ?",
    a: "Oui. Tous les blocs et nuances sont traités à égalité, avec les codes couleurs officiels du ministère de l'Intérieur. MOUVANCIA fournit l'analyse ; les conclusions stratégiques vous appartiennent.",
  },
  {
    q: "D'où viennent les données et à quelle fréquence sont-elles à jour ?",
    a: "Des sources officielles : ministère de l'Intérieur, INSEE, Assemblée nationale et Commission des sondages. L'historique des scrutins est figé ; les sondages, scrutins de l'Assemblée et la veille sont rafraîchis automatiquement chaque jour.",
  },
  {
    q: "Faut-il des compétences techniques pour l'utiliser ?",
    a: "Non. Les analyses s'exécutent dans votre navigateur, sans installation. Carte, comparaisons et simulateur sont pensés pour être pris en main en quelques minutes par une équipe de campagne.",
  },
  {
    q: "Puis-je résilier à tout moment ?",
    a: "Oui. L'essai de 14 jours est sans carte bancaire et sans engagement, et l'abonnement est résiliable quand vous le souhaitez.",
  },
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
    <div
      className={cn(display.variable, body.variable, "flex-1 bg-canvas text-foreground")}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* ── Header landing (propre, sans navbar applicative) ─────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <Logo />
            <span className={cn(DISPLAY, "text-[15px] font-extrabold uppercase tracking-[0.14em]")}>
              Mouvancia
            </span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-2">
            {authed ? (
              <PrimaryLink href="/espace">
                Accéder à mon QG <ArrowRight className="h-4 w-4" />
              </PrimaryLink>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="hidden rounded-pill px-3.5 py-2 text-[13.5px] font-medium text-foreground/75 transition-colors hover:bg-surface-soft hover:text-foreground sm:inline-block"
                >
                  Se connecter
                </Link>
                <PrimaryLink href="/auth/signup">Essai gratuit</PrimaryLink>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Halo chaud diffus, ancré à droite (asymétrie). */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-24 h-[520px] w-[520px] rounded-full bg-warm/15 blur-[120px]"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:pb-24 lg:pt-20">
          <div className="anim-fade-in">
            <span className="inline-flex items-center gap-2.5 rounded-pill border border-warm/30 bg-warm/[0.08] py-1.5 pl-3 pr-3.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-warm">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warm" />
              Présidentielle &amp; législatives 2027
            </span>
            <h1
              className={cn(
                DISPLAY,
                "mt-6 max-w-[16ch] text-[clamp(2.7rem,6.4vw,5.1rem)] font-extrabold leading-[0.94] tracking-[-0.025em]",
              )}
            >
              L&apos;intelligence électorale, du national au <Mark>bureau de vote</Mark>.
            </h1>
            <p className="mt-7 max-w-[56ch] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">
              MOUVANCIA réunit l&apos;analyse électorale (cartographie, historique, sociologie, simulation)
              et le pilotage de campagne sur le terrain, dans un seul outil. Données ouvertes, requêtes
              instantanées.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              {authed ? (
                <CtaPrimary href="/espace">
                  Accéder à mon QG <ArrowRight className="h-[18px] w-[18px]" />
                </CtaPrimary>
              ) : (
                <>
                  <CtaPrimary href="/auth/signup">
                    Démarrer l&apos;essai gratuit <ArrowRight className="h-[18px] w-[18px]" />
                  </CtaPrimary>
                  <CtaGhost href="/auth/login">Se connecter</CtaGhost>
                </>
              )}
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted-foreground">
              <Dot /> Sans carte bancaire
              <Dot /> Données officielles
              <Dot /> Conçu pour candidats, partis &amp; cabinets
            </p>
          </div>
          <LandingDeck />
        </div>

        {/* Bandeau de chiffres — compteurs animés à l'entrée dans le viewport. */}
        <LandingStats />
      </section>

      {/* ── Bande de crédibilité (sources institutionnelles) ─────────────── */}
      <section className="border-b border-border/60 bg-surface/30">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-10">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Données officielles, sourcées
          </p>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5">
            {SOURCES.map((s) => (
              <span key={s} className={cn(DISPLAY, "text-[13.5px] font-bold tracking-tight text-foreground/55")}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <SectionLabel>Comment ça marche</SectionLabel>
        <div className="anim-stagger mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <span className={cn(DISPLAY, "text-[15px] font-bold tabular-nums text-warm")}>{s.n}</span>
              <span aria-hidden className="mt-3 block h-px w-full bg-border" />
              <h3 className={cn(DISPLAY, "mt-4 text-[20px] font-bold tracking-[-0.01em]")}>{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trois produits — liste éditoriale numérotée (pas une grille de cartes) ── */}
      <section className="mx-auto max-w-6xl px-5 pb-4 sm:px-8">
        <div className="flex items-end justify-between gap-6">
          <h2 className={cn(DISPLAY, "max-w-[18ch] text-[clamp(1.8rem,3.6vw,2.9rem)] font-extrabold leading-[1.02] tracking-[-0.02em]")}>
            Trois produits, un même terrain.
          </h2>
          <span className="hidden shrink-0 pb-1.5 text-[12px] text-muted-foreground sm:block">L&apos;analyse → l&apos;action</span>
        </div>
        <div className="mt-10 flex flex-col">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.href}
                href={p.href}
                className="group grid grid-cols-[auto_1fr_auto] items-start gap-5 border-t border-border py-8 transition-colors last:border-b hover:bg-surface/50 sm:gap-8 sm:py-9"
              >
                <span className={cn(DISPLAY, "text-[clamp(1.6rem,4vw,2.6rem)] font-bold leading-none tabular-nums text-muted-foreground/40 transition-colors group-hover:text-warm")}>
                  {p.index}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-[18px] w-[18px] text-warm" />
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{p.kicker}</span>
                  </div>
                  <h3 className={cn(DISPLAY, "mt-1.5 text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold tracking-[-0.02em]")}>{p.title}</h3>
                  <p className="mt-2.5 max-w-[60ch] text-[14.5px] leading-relaxed text-muted-foreground">{p.desc}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {p.points.map((pt) => (
                      <li key={pt} className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11.5px] text-foreground/70">
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
                <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-pill border border-border text-muted-foreground transition-all group-hover:border-warm group-hover:bg-warm group-hover:text-[#0a0a0c]">
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Séquence de zoom : du national au bureau de vote ─────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="max-w-2xl">
          <SectionLabel>Explorer</SectionLabel>
          <h2 className={cn(DISPLAY, "mt-3 text-[clamp(1.8rem,3.6vw,2.9rem)] font-extrabold leading-[1.02] tracking-[-0.02em]")}>
            Du national au bureau de vote.
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
            La même carte, cinq échelles. Zoomez du résultat national jusqu&apos;au moindre bureau de vote —
            10 scrutins, la sociologie et les dynamiques de blocs, partout.
          </p>
        </div>
        <div className="mt-12 lg:mt-16">
          <LandingZoom />
        </div>
      </section>

      {/* ── QG — pilotage de campagne ────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="overflow-hidden rounded-3xl border border-warm/25 bg-warm/[0.06]">
          <div className="px-6 pt-8 sm:px-10 sm:pt-10">
            <div className="flex items-center gap-2 text-warm">
              <Megaphone className="h-[18px] w-[18px]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.13em]">Mon QG · le cockpit de campagne</span>
            </div>
            <h2 className={cn(DISPLAY, "mt-4 max-w-[20ch] text-[clamp(1.7rem,3.4vw,2.6rem)] font-extrabold leading-[1.04] tracking-[-0.02em]")}>
              De l&apos;analyse à l&apos;action, avec votre équipe.
            </h2>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
              Transformez vos analyses en plan d&apos;action : ciblez les bureaux, organisez le porte-à-porte
              et le phoning, suivez le sentiment de terrain et coordonnez vos bénévoles, en temps réel.
            </p>
          </div>
          <div className="mt-7 grid gap-px border-t border-warm/15 bg-warm/15 sm:grid-cols-2 lg:grid-cols-3">
            {QG_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex flex-col gap-2 bg-canvas p-6">
                  <Icon className="h-[19px] w-[19px] text-warm" />
                  <h3 className={cn(DISPLAY, "mt-1 text-[15.5px] font-bold tracking-[-0.01em]")}>{f.title}</h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
            {/* Cellule de clôture : invite à entrer dans le QG. */}
            <Link
              href={authed ? "/espace" : "/auth/signup"}
              className="group flex flex-col justify-between gap-4 bg-primary p-6 text-primary-foreground"
            >
              <span className="text-[13px] leading-relaxed text-primary-foreground/70">
                Votre quartier général de campagne, prêt à l&apos;emploi.
              </span>
              <span className={cn(DISPLAY, "inline-flex items-center gap-1.5 text-[15px] font-bold")}>
                {authed ? "Ouvrir mon QG" : "Créer mon QG"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Outils d'analyse ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-4 sm:px-8">
        <SectionLabel>Outils d&apos;analyse</SectionLabel>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="group flex items-center gap-3.5 rounded-2xl border border-border bg-surface px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-warm/40 hover:shadow-card"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warm/12 text-warm">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className={cn(DISPLAY, "text-[14px] font-bold leading-tight")}>{t.title}</span>
                  <span className="truncate text-[11.5px] text-muted-foreground">{t.desc}</span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-warm" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Confiance ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
          {TRUST.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.title} className="flex flex-col gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-foreground/70">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <h3 className={cn(DISPLAY, "mt-1 text-[15px] font-bold tracking-[-0.01em]")}>{t.title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{t.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Tarifs ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
        <div className="max-w-2xl">
          <SectionLabel>Tarifs</SectionLabel>
          <h2 className={cn(DISPLAY, "mt-3 text-[clamp(1.8rem,3.6vw,2.7rem)] font-extrabold leading-[1.02] tracking-[-0.02em]")}>
            Une formule pour chaque campagne.
          </h2>
          <p className="mt-3 text-[14.5px] text-muted-foreground">Essai gratuit de 14 jours · sans carte bancaire · sans engagement.</p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
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
                  "flex flex-col rounded-2xl p-6",
                  featured
                    ? "border-2 border-warm bg-warm/[0.05] shadow-floating"
                    : "border border-border bg-surface",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className={cn(DISPLAY, "text-[16px] font-bold")}>{p.name}</p>
                  {featured && (
                    <span className="rounded-pill bg-warm px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0a0a0c]">
                      Recommandé
                    </span>
                  )}
                </div>
                <p className={cn(DISPLAY, "mt-4 text-[34px] font-extrabold leading-none tracking-[-0.02em]")}>
                  {p.price}
                  <span className="text-[13px] font-medium text-muted-foreground"> {p.period}</span>
                </p>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">{p.seats}</p>
                <p className="mt-2.5 text-[13px] text-muted-foreground">{p.tagline}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-foreground/80">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={cn(
                    "mt-6 inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-2.5 text-[13.5px] font-semibold transition-all",
                    featured
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border bg-surface text-foreground/80 hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {cta}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 lg:py-20">
        <SectionLabel>Questions fréquentes</SectionLabel>
        <h2 className={cn(DISPLAY, "mt-3 text-[clamp(1.7rem,3.4vw,2.5rem)] font-extrabold leading-[1.04] tracking-[-0.02em]")}>
          Tout ce qu&apos;il faut savoir avant de commencer.
        </h2>
        <div className="mt-8 border-t border-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15.5px] font-semibold text-foreground transition-colors hover:text-foreground/70 [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill border border-border text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <p className="max-w-[62ch] pb-5 text-[14px] leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-7 py-12 text-primary-foreground sm:px-12 sm:py-14">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-warm/25 blur-[90px]" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className={cn(DISPLAY, "text-[clamp(1.7rem,3.4vw,2.5rem)] font-extrabold leading-[1.02] tracking-[-0.02em]")}>
                Prêt à préparer 2027 ?
              </h2>
              <p className="mt-2 max-w-[48ch] text-[14.5px] text-primary-foreground/65">
                {authed
                  ? "Votre QG vous attend."
                  : "Essai gratuit, sans engagement. Données ouvertes, mises à jour quotidiennes."}
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              {authed ? (
                <Link href="/espace" className="inline-flex items-center gap-2 rounded-pill bg-warm px-5 py-3 text-[14px] font-bold text-[#0a0a0c] transition-opacity hover:opacity-90">
                  Accéder à mon QG <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link href="/auth/signup" className="inline-flex items-center gap-2 rounded-pill bg-warm px-5 py-3 text-[14px] font-bold text-[#0a0a0c] transition-opacity hover:opacity-90">
                    Démarrer l&apos;essai gratuit <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/auth/login" className="inline-flex items-center rounded-pill border border-primary-foreground/25 px-5 py-3 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10">
                    Se connecter
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="mx-auto max-w-6xl px-5 pb-14 pt-2 sm:px-8">
        <div className="flex flex-col gap-3 border-t border-border pt-6 text-[11.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <Logo small />
            <span className={cn(DISPLAY, "font-bold uppercase tracking-[0.12em] text-foreground/80")}>Mouvancia</span>
          </span>
          <span>Sources · Ministère de l&apos;Intérieur · INSEE · Assemblée nationale · Commission des sondages</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Sous-composants présentation
   ───────────────────────────────────────────────────────────────────────── */

/** Marque de la landing (header + footer) — délègue au composant partagé. */
function Logo({ small }: { small?: boolean }) {
  return small ? (
    <BrandMark tileClassName="h-6 w-6 rounded-[6px]" svgClassName="h-[15px] w-[15px]" />
  ) : (
    <BrandMark />
  );
}

/** Soulignement chaud net (solide, sans dégradé) sous un mot-clé du titre. */
function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative whitespace-nowrap">
      {children}
      <span aria-hidden className="absolute inset-x-0 bottom-[0.02em] block h-[0.1em] rounded-full bg-warm" />
    </span>
  );
}

function Dot() {
  return <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-muted-foreground/50" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      <span aria-hidden className="h-px w-6 bg-warm" />
      {children}
    </p>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill bg-primary px-4 py-2 text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      {children}
    </Link>
  );
}

function CtaPrimary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-3 text-[14.5px] font-semibold text-primary-foreground shadow-card transition-all hover:-translate-y-0.5 hover:opacity-95"
    >
      {children}
    </Link>
  );
}

function CtaGhost({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-5 py-3 text-[14.5px] font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      {children}
    </Link>
  );
}

