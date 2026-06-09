"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, ArrowUpRight, BarChart3, CalendarDays, ExternalLink, Landmark,
  MapPin, Newspaper, PenLine, UserRound, Vote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NewsArticle } from "@/app/api/news/route";
import { useCampaign, useLoaded as useCampaignLoaded } from "@/lib/campaign";
import { territoryFrom } from "@/lib/territoire";
import { useDeputes } from "@/lib/deputes";
import { useNotices, formatDateFr, relativeFr, cleanLabel } from "@/lib/sondages";
import { useVotesAN, useAgenda, useVeille } from "@/lib/suivi";
import { useParrainages, SEUIL } from "@/lib/parrainages";
import { nuanceColor } from "@/lib/nuances";
import type { Section } from "@/app/suivre/suivre-view";

/**
 * Briefing — écran d'arrivée de « Suivre » : la situation du jour en un coup
 * d'œil, territorialisée sur la cible de campagne du QG (presse locale,
 * député de la circonscription), plus l'essentiel national (dernier sondage,
 * prochaine échéance, dernier vote AN, parrainages).
 */

const fmtInt = (n: number) => n.toLocaleString("fr-FR");

/** Jours restants (entiers, fuseau local) jusqu'à une date ISO `YYYY-MM-DD`. */
function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function todayFr(): string {
  const s = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Presse du territoire (Google Actualités via /api/news). */
function useTerritoryNews(query: string | null) {
  return useQuery({
    enabled: !!query,
    queryKey: ["local-news", query],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<NewsArticle[]> => {
      const res = await fetch(`/api/news?q=${encodeURIComponent(query ?? "")}`);
      if (!res.ok) throw new Error("indisponible");
      const j = (await res.json()) as { articles?: NewsArticle[] };
      return j.articles ?? [];
    },
  });
}

export function BriefingView({ onOpen }: { onOpen: (s: Section) => void }) {
  const campaign = useCampaign();
  const campaignLoaded = useCampaignLoaded();
  const territory = useMemo(() => territoryFrom(campaign?.target), [campaign?.target]);

  const notices = useNotices();
  const votes = useVotesAN();
  const agenda = useAgenda();
  const veille = useVeille();
  const parrainages = useParrainages();
  const deputes = useDeputes(!!territory?.circoCode);
  const news = useTerritoryNews(territory?.newsQuery ?? null);

  // ── Dérivations « dernier / prochain » ────────────────────────────────────
  const lastNotice = useMemo(() => {
    const list = [...(notices.data?.notices ?? [])];
    list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return list[0] ?? null;
  }, [notices.data]);
  const lastNoticeTop = useMemo(() => {
    const ints = lastNotice?.intentions ?? [];
    if (ints.length === 0) return null;
    return [...ints].sort((a, b) => (b.redresse ?? b.brut) - (a.redresse ?? a.brut))[0];
  }, [lastNotice]);

  const lastVote = useMemo(() => {
    const list = [...(votes.data?.votes ?? [])];
    list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return list[0] ?? null;
  }, [votes.data]);

  const nextEvent = useMemo(
    () => (agenda.data?.evenements ?? []).find((e) => !e.passe) ?? null,
    [agenda.data],
  );

  const topParrainage = useMemo(() => {
    const list = [...(parrainages.data?.candidats ?? [])];
    list.sort((a, b) => b.total - a.total);
    return list[0] ?? null;
  }, [parrainages.data]);

  const depute = territory?.circoCode ? deputes.data?.get(territory.circoCode) ?? null : null;
  const headlines = (veille.data?.articles ?? []).slice(0, 5);
  const localNews = (news.data ?? []).slice(0, 3);

  // Sondages mentionnant la commune / le département du QG.
  const localNotices = useMemo(() => {
    if (!territory) return [];
    const needle = (territory.communeName ?? "").toLowerCase();
    const dept = (territory.deptName ?? "").toLowerCase();
    return (notices.data?.notices ?? []).filter((n) => {
      const c = (n.commune ?? "").toLowerCase();
      if (!c) return false;
      return (needle && c.includes(needle)) || (dept && c.includes(dept));
    });
  }, [notices.data, territory]);

  return (
    <section className="min-w-0 flex-1 overflow-y-auto rounded-lg bg-surface shadow-card">
      <div className="anim-stagger mx-auto flex max-w-[1080px] flex-col gap-7 p-5 lg:p-8">
        {/* ── En-tête éditorial ─────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-warm">Briefing</p>
            <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight lg:text-[32px]">
              {todayFr()}
            </h1>
          </div>
          {campaignLoaded && (
            territory ? (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1.5 text-[12px] font-medium">
                <MapPin className="h-3.5 w-3.5 text-warm" /> {territory.shortLabel}
              </span>
            ) : (
              <Link
                href="/espace?tab=campaign"
                className="inline-flex items-center gap-1.5 rounded-pill bg-foreground/[0.04] px-3 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.08]"
              >
                <PenLine className="h-3.5 w-3.5" /> Définir mon territoire
                <ArrowRight className="h-3 w-3" />
              </Link>
            )
          )}
        </header>

        {/* ── L'essentiel national ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeroCard
            icon={BarChart3}
            label="Dernier sondage"
            loading={notices.isLoading}
            onClick={() => onOpen("opinion")}
          >
            {lastNotice ? (
              <>
                {lastNoticeTop ? (
                  <p className="text-[28px] font-semibold leading-none tracking-tight">
                    {Math.round(lastNoticeTop.redresse ?? lastNoticeTop.brut)}
                    <span className="text-[16px] font-medium text-muted-foreground"> %</span>
                  </p>
                ) : (
                  <p className="text-[20px] font-semibold leading-tight tracking-tight">
                    {lastNotice.institut ?? lastNotice.nature_label}
                  </p>
                )}
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                  {cleanLabel(lastNotice)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/80">
                  {lastNotice.institut ? `${lastNotice.institut} · ` : ""}{relativeFr(lastNotice.date)}
                </p>
              </>
            ) : (
              <CardEmpty />
            )}
          </HeroCard>

          <HeroCard
            icon={CalendarDays}
            label="Prochaine échéance"
            loading={agenda.isLoading}
            onClick={() => onOpen("echeances")}
          >
            {nextEvent ? (
              <>
                <p className="text-[28px] font-semibold leading-none tracking-tight">
                  {daysUntil(nextEvent.date) <= 0 ? "Auj." : `J−${fmtInt(daysUntil(nextEvent.date))}`}
                </p>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">{nextEvent.titre}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/80">{formatDateFr(nextEvent.date)}</p>
              </>
            ) : (
              <CardEmpty />
            )}
          </HeroCard>

          <HeroCard
            icon={Landmark}
            label="Dernier vote AN"
            loading={votes.isLoading}
            onClick={() => onOpen("parlement")}
          >
            {lastVote ? (
              <>
                <p>
                  <span
                    className={cn(
                      "inline-flex rounded-pill px-2 py-0.5 text-[11px] font-semibold",
                      (lastVote.sort ?? "").toLowerCase().includes("adopt")
                        ? "bg-success/12 text-success"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {lastVote.sort_libelle ?? lastVote.sort ?? "—"} · {fmtInt(lastVote.pour)} / {fmtInt(lastVote.contre)}
                  </span>
                </p>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">{lastVote.titre}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/80">{relativeFr(lastVote.date)}</p>
              </>
            ) : (
              <CardEmpty />
            )}
          </HeroCard>

          <HeroCard
            icon={Vote}
            label={`Parrainages 2027${parrainages.data?.demo ? " · démo" : ""}`}
            loading={parrainages.isLoading}
            href="/suivre/parrainages"
          >
            {topParrainage ? (
              <>
                <p className="text-[28px] font-semibold leading-none tracking-tight">
                  {fmtInt(topParrainage.total)}
                  <span className="text-[14px] font-medium text-muted-foreground"> / {SEUIL}</span>
                </p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: nuanceColor(topParrainage.nuance) }} />
                  {topParrainage.nom} — en tête
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/80">maj {relativeFr(parrainages.data?.updatedAt ?? null)}</p>
              </>
            ) : (
              <CardEmpty />
            )}
          </HeroCard>
        </div>

        {/* ── Votre territoire ──────────────────────────────────────────── */}
        {territory && (
          <section>
            <SectionHeading
              title="Votre territoire"
              detail={territory.shortLabel}
              action={{ label: "Toute la presse du territoire", onClick: () => onOpen("medias") }}
            />
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
              {depute && territory.circoCode && (
                <Link
                  href={`/elu/${encodeURIComponent(territory.circoCode)}`}
                  className="group flex flex-col rounded-lg border border-border/60 bg-surface-alt p-4 transition-colors hover:border-warm/50"
                >
                  <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    <UserRound className="h-3 w-3" /> Votre député·e
                  </p>
                  <p className="mt-2 text-[17px] font-semibold leading-tight tracking-tight">
                    {[depute.prenom, depute.nom].filter(Boolean).join(" ")}
                  </p>
                  <p className="mt-1.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: `${depute.groupeColor ?? "#8a8a93"}1a`,
                        color: depute.groupeColor ?? "var(--muted-foreground)",
                      }}
                    >
                      {depute.groupe ?? "Groupe n.c."}
                    </span>
                  </p>
                  {depute.groupeLib && (
                    <p className="mt-1.5 line-clamp-2 text-[11.5px] text-muted-foreground">{depute.groupeLib}</p>
                  )}
                  <p className="mt-auto pt-3 text-[12px] font-medium text-warm">
                    Fiche élu·e <ArrowUpRight className="inline h-3 w-3" />
                  </p>
                </Link>
              )}

              <div className={cn("rounded-lg border border-border/60 p-4", !(depute && territory.circoCode) && "lg:col-span-2")}>
                <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  <Newspaper className="h-3 w-3" /> Presse — {territory.newsQuery}
                </p>
                {news.isLoading ? (
                  <LoadingRows n={3} />
                ) : localNews.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-muted-foreground">
                    Aucun article récent pour « {territory.newsQuery} ».
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-border/40">
                    {localNews.map((a, i) => (
                      <li key={`${a.url}-${i}`}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-baseline justify-between gap-3 py-2.5"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium leading-snug group-hover:text-warm">
                              {a.title}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">{a.source ?? "Presse"}</span>
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {localNotices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpen("opinion")}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-warm/12 px-2.5 py-1 text-[11.5px] font-medium text-warm transition-colors hover:bg-warm/20"
                  >
                    <BarChart3 className="h-3 w-3" />
                    {localNotices.length} sondage{localNotices.length > 1 ? "s" : ""} sur votre territoire
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── À la une (veille nationale) ───────────────────────────────── */}
        <section>
          <SectionHeading
            title="À la une"
            detail="veille média nationale"
            action={{ label: "Tous les articles", onClick: () => onOpen("medias") }}
          />
          {veille.isLoading ? (
            <LoadingRows n={5} />
          ) : headlines.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted-foreground">Aucun article pour le moment.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/40">
              {headlines.map((a) => (
                <li key={a.lien}>
                  <a
                    href={a.lien}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-3 py-2.5"
                  >
                    <span className="w-24 shrink-0 truncate text-[11.5px] font-medium text-muted-foreground">{a.source}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] leading-snug group-hover:text-warm">{a.titre}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{relativeFr(a.date)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

// ─── Primitives du briefing ───────────────────────────────────────────────────

function SectionHeading({
  title, detail, action,
}: {
  title: string; detail?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2">
      <h2 className="text-[15px] font-semibold tracking-tight">
        {title}
        {detail && <span className="ml-2 text-[12px] font-normal text-muted-foreground">{detail}</span>}
      </h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-warm transition-opacity hover:opacity-80"
        >
          {action.label} <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function HeroCard({
  icon: Icon, label, loading, children, onClick, href,
}: {
  icon: typeof Vote; label: string; loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void; href?: string;
}) {
  const body = (
    <>
      <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <div className="mt-2.5">
        {loading ? <LoadingRows n={2} /> : children}
      </div>
    </>
  );
  const cls =
    "flex flex-col rounded-lg border border-border/60 bg-surface-alt p-4 text-left transition-colors hover:border-warm/50";
  if (href) {
    return <Link href={href} className={cls}>{body}</Link>;
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function CardEmpty() {
  return <p className="text-[12px] text-muted-foreground">Aucune donnée pour le moment.</p>;
}

function LoadingRows({ n }: { n: number }) {
  return (
    <div className="mt-1 flex flex-col gap-2" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="h-3 animate-pulse rounded bg-surface-soft" style={{ width: `${85 - i * 18}%` }} />
      ))}
    </div>
  );
}
