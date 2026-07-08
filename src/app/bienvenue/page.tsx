import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  GitCompare,
  Hourglass,
  Map as MapIcon,
  Megaphone,
  Search,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { daysLeft, formatDateFr } from "@/lib/billing";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bienvenue — MOUVANCIA" };

const PILLARS = [
  {
    href: "/explorer",
    icon: MapIcon,
    title: "Explorer",
    desc: "La carte électorale interactive : 10 scrutins, du national au bureau de vote, sociologie INSEE au clic.",
  },
  {
    href: "/analyser",
    icon: GitCompare,
    title: "Analyser",
    desc: "Swing entre scrutins, corrélations socio-vote, sièges marginaux et simulateur de projection.",
  },
  {
    href: "/suivre",
    icon: Activity,
    title: "Suivre",
    desc: "Sondages de la Commission, scrutins de l'Assemblée, agenda électoral — rafraîchis chaque jour.",
  },
  {
    href: "/espace",
    icon: Megaphone,
    title: "Mon QG",
    desc: "Votre campagne : circonscription cible, objectif de voix, terrain, équipe et bénévoles.",
  },
];

const FIRST_STEPS = [
  {
    href: "/explorer",
    label: "Affichez votre territoire sur la carte",
    hint: "Zoomez de la France entière à votre commune, changez de scrutin et de maille.",
  },
  {
    href: "/explorer",
    label: "Ouvrez la fiche d'une circonscription",
    hint: "Un clic sur la carte — ou ⌘K pour chercher un territoire, un candidat, un élu.",
  },
  {
    href: "/suivre/sondages",
    label: "Consultez les derniers sondages 2027",
    hint: "Classés par scrutin, avec les courbes de tendance par candidat.",
  },
  {
    href: "/espace",
    label: "Montez votre QG de campagne",
    hint: "Créez votre équipe, fixez votre objectif de voix, bâtissez le plan de terrain.",
  },
];

export default async function BienvenuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/bienvenue");

  const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const firstName = ((p?.full_name as string | null) ?? "").trim().split(/\s+/)[0] || null;
  const status = (p?.subscription_status as string | null) ?? "trial";
  const trialEndsAt = (p?.trial_ends_at as string | null) ?? null;
  const days = daysLeft(trialEndsAt);
  const onTrial = status === "trial";

  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* ── Accueil ─────────────────────────────────────────────────── */}
        <span className="inline-flex items-center gap-2 rounded-pill border border-warm/30 bg-warm/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-warm">
          <Sparkles className="h-3.5 w-3.5" />
          {onTrial ? "Votre essai gratuit a commencé" : "Votre compte est prêt"}
        </span>
        <h1 className="mt-4 text-[30px] font-semibold leading-tight tracking-tight">
          Bienvenue{firstName ? ` ${firstName}` : ""} — préparons 2027.
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
          {onTrial ? (
            <>
              Vous disposez de <span className="font-medium text-foreground">14 jours d&apos;accès complet</span>
              {" "}à l&apos;analyse électorale et au pilotage de campagne
              {trialEndsAt && (
                <>
                  {" "}
                  — jusqu&apos;au <span className="font-medium text-foreground">{formatDateFr(trialEndsAt)}</span>
                  {days != null && days > 0 && <> ({days} jour{days > 1 ? "s" : ""})</>}
                </>
              )}
              . Sans carte bancaire : à la fin de l&apos;essai, vous choisissez (ou non) une formule.
            </>
          ) : (
            <>Tout est en place. Voici les quatre espaces de travail de votre outil d&apos;analyse.</>
          )}
        </p>

        {/* ── Les 4 piliers ───────────────────────────────────────────── */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <Link
                key={pillar.href}
                href={pillar.href}
                className={cn(
                  "group flex flex-col rounded-xl border border-border bg-surface p-5 shadow-card transition-all",
                  "hover:-translate-y-0.5 hover:border-warm/50 hover:shadow-floating",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-warm/12 text-warm">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                    0{i + 1}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
                  {pillar.title}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-warm" />
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{pillar.desc}</p>
              </Link>
            );
          })}
        </div>

        {/* ── Premiers pas ────────────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="text-[16px] font-semibold tracking-tight">Vos premiers pas</h2>
          <ol className="mt-3 flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-surface shadow-card">
            {FIRST_STEPS.map((s, i) => (
              <li key={s.label}>
                <Link href={s.href} className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-soft/60">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-warm/50 text-[11px] font-semibold text-warm">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{s.label}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{s.hint}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-warm" />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/explorer"
            className="inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Commencer l&apos;exploration <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            Astuce : <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10.5px] font-medium">⌘K</kbd>
            ouvre la recherche universelle partout.
          </span>
        </div>

        {onTrial && (
          <p className="mt-6 flex items-center gap-2 text-[12px] text-muted-foreground">
            <Hourglass className="h-3.5 w-3.5 text-warm" />
            Déjà convaincu ?{" "}
            <Link href="/auth/abonnement" className="font-medium text-foreground underline-offset-2 hover:underline">
              Découvrir les formules
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
