"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Play, Pause, RotateCcw, Maximize2, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Choropleth } from "@/components/map";
import { buildNuanceMatchExpression, nuanceColor, nuanceLabel } from "@/lib/nuances";
import { SCRUTIN_LABELS, type Scrutin } from "@/lib/url-state";
import { useSoireeData, type SoireeDept } from "@/lib/soiree";
import { fmtInt, fmtPct } from "@/lib/format";
import { ErrorState } from "@/components/error-state";
import { InlineLoading } from "@/components/inline-loading";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

const SCRUTINS: Scrutin[] = [
  "presid-2022-t1",
  "presid-2022-t2",
  "presid-2017-t1",
  "presid-2017-t2",
  "legis-2024-t1",
  "legis-2024-t2",
  "legis-2022-t1",
  "legis-2022-t2",
];

const SPEEDS = [1, 2, 4] as const;

type RunningCand = { label: string; nuance: string; voix: number; pct: number };

export function SoireeView() {
  const [scrutin, setScrutin] = useState<Scrutin>("presid-2022-t1");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);

  // Changement de scrutin → on recommence le dépouillement (ajusté pendant le
  // rendu plutôt que dans un effet, pour éviter un rendu en cascade).
  const [prevScrutin, setPrevScrutin] = useState(scrutin);
  if (scrutin !== prevScrutin) {
    setPrevScrutin(scrutin);
    setProgress(0);
    setPlaying(true);
  }

  const q = useSoireeData(scrutin);
  const depts = useMemo(() => q.data ?? [], [q.data]);
  const total = depts.length;

  // Rejeu : avance la progression jusqu'à dépouillement complet.
  useEffect(() => {
    if (!playing || total === 0) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(1, p + 0.012 * speed);
        if (next >= 1) setPlaying(false);
        return next;
      });
    }, 90);
    return () => clearInterval(id);
  }, [playing, speed, total]);

  const revealedCount = Math.round(progress * total);
  const revealed = useMemo(() => depts.slice(0, revealedCount), [depts, revealedCount]);

  const stats = useMemo(() => {
    let inscrits = 0, votants = 0, exprimes = 0;
    const byLabel = new Map<string, RunningCand>();
    for (const d of revealed) {
      inscrits += d.inscrits;
      votants += d.votants;
      exprimes += d.exprimes;
      for (const c of d.cands) {
        const cur = byLabel.get(c.label) ?? { label: c.label, nuance: c.nuance, voix: 0, pct: 0 };
        cur.voix += c.voix;
        byLabel.set(c.label, cur);
      }
    }
    const ranking = [...byLabel.values()]
      .map((c) => ({ ...c, pct: exprimes > 0 ? c.voix / exprimes : 0 }))
      .sort((a, b) => b.voix - a.voix);
    return {
      inscrits,
      votants,
      exprimes,
      participation: inscrits > 0 ? votants / inscrits : 0,
      ranking,
      leader: ranking[0] ?? null,
      runnerUp: ranking[1] ?? null,
    };
  }, [revealed]);

  const choropleth = useMemo<Choropleth>(
    () => ({
      stateKey: "nuance",
      paint: buildNuanceMatchExpression() as unknown as Choropleth["paint"],
      data: revealed.map((d) => ({ code: d.code, value: d.winner })),
    }),
    [revealed],
  );

  const done = total > 0 && revealedCount >= total;
  const leadGap = stats.leader && stats.runnerUp ? stats.leader.pct - stats.runnerUp.pct : 0;

  function toggleFocus() {
    if (typeof document !== "undefined") document.documentElement.classList.toggle("focus-mode");
  }

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem-var(--bottom-nav))] w-full flex-col bg-canvas">
      {/* En-tête soirée */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/70 bg-surface/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-warm" />
          <h1 className="text-[15px] font-semibold tracking-tight">Soirée électorale</h1>
        </div>
        <select
          value={scrutin}
          onChange={(e) => setScrutin(e.target.value as Scrutin)}
          className="rounded-pill bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground outline-none"
          aria-label="Scrutin à rejouer"
        >
          {SCRUTINS.map((s) => (
            <option key={s} value={s} className="bg-surface text-foreground">
              {SCRUTIN_LABELS[s].short}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Dépouillement</span>
          <span className="text-[15px] font-semibold tabular-nums">{Math.round(progress * 100)} %</span>
          <span className="text-[12px] text-muted-foreground">· {fmtInt(revealedCount)}/{fmtInt(total)} dép.</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Participation</span>
          <span className="text-[15px] font-semibold tabular-nums">{stats.inscrits > 0 ? fmtPct(stats.participation) : "—"}</span>
        </div>

        <button
          type="button"
          onClick={toggleFocus}
          title="Mode focus (touche F)"
          className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-surface-soft"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Focus
        </button>
      </header>

      {q.isError ? (
        <ErrorState className="m-6" message="Impossible de charger les résultats de ce scrutin." onRetry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <InlineLoading label="Préparation de la soirée…" />
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] lg:grid-cols-[1fr_380px] lg:grid-rows-1">
          {/* Carte */}
          <div className="relative min-h-[280px] border-border/70 lg:border-r">
            <MapView className="h-full w-full" maille="departements" choropleth={choropleth} />
            {/* Bandeau de tête superposé */}
            {stats.leader && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-border bg-surface/95 px-4 py-3 shadow-floating backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">En tête</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: nuanceColor(stats.leader.nuance) }} />
                  <span className="text-[18px] font-semibold leading-none">{stats.leader.label || nuanceLabel(stats.leader.nuance)}</span>
                  <span className="text-[18px] font-bold tabular-nums">{fmtPct(stats.leader.pct)}</span>
                </div>
                {stats.runnerUp && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    +{fmtPct(leadGap)} sur {stats.runnerUp.label || nuanceLabel(stats.runnerUp.nuance)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Panneau : classement + faits marquants */}
          <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto bg-surface/40 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Classement national {done ? "· définitif" : "· en cours"}
              </p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {stats.ranking.slice(0, 8).map((c) => (
                  <li key={c.label} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: nuanceColor(c.nuance) }} />
                        <span className="truncate font-medium">{c.label || nuanceLabel(c.nuance)}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{fmtPct(c.pct)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-pill bg-surface-soft">
                      <span
                        className="block h-full rounded-pill transition-[width] duration-300 ease-out"
                        style={{ width: `${Math.min(100, (c.pct / (stats.leader?.pct || 1)) * 100)}%`, background: nuanceColor(c.nuance) }}
                      />
                    </div>
                  </li>
                ))}
                {stats.ranking.length === 0 && (
                  <li className="text-[12px] text-muted-foreground">En attente des premiers résultats…</li>
                )}
              </ul>
            </div>

            <Highlights revealed={revealed} />
          </aside>
        </div>
      )}

      {/* Contrôles de rejeu */}
      <div className="flex items-center gap-3 border-t border-border/70 bg-surface/60 px-4 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={() => {
            if (done) {
              setProgress(0);
              setPlaying(true);
            } else {
              setPlaying((p) => !p);
            }
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          aria-label={done ? "Rejouer" : playing ? "Pause" : "Lecture"}
        >
          {done ? <RotateCcw className="h-4 w-4" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(progress * 100)}
          onChange={(e) => {
            setPlaying(false);
            setProgress(Number(e.target.value) / 100);
          }}
          className="h-1.5 flex-1 accent-[color:var(--warm)]"
          aria-label="Progression du dépouillement"
        />
        <div className="inline-flex items-center gap-0.5 rounded-pill bg-surface-soft/70 p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={cn(
                "rounded-pill px-2 py-0.5 text-[11px] font-medium transition-colors",
                speed === s ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]" : "text-muted-foreground hover:text-foreground",
              )}
            >
              ×{s}
            </button>
          ))}
        </div>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          Rejeu d&apos;une soirée · données réelles{q.isFetching ? " · chargement" : ""}
        </span>
        {q.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground sm:hidden" />}
      </div>
    </div>
  );
}

/** Faits marquants dérivés des départements déjà dépouillés. */
function Highlights({ revealed }: { revealed: SoireeDept[] }) {
  const facts = useMemo(() => {
    if (revealed.length === 0) return null;
    const withPart = revealed
      .filter((d) => d.inscrits > 0)
      .map((d) => ({ d, part: d.votants / d.inscrits }));
    const top = [...withPart].sort((a, b) => b.part - a.part)[0];
    const low = [...withPart].sort((a, b) => a.part - b.part)[0];
    return { top, low };
  }, [revealed]);

  if (!facts) return null;
  return (
    <div className="rounded-xl border border-border/70 bg-surface p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Faits marquants</p>
      <ul className="mt-2.5 flex flex-col gap-2 text-[12px]">
        <li className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-success" />
          <span className="text-foreground/80">Participation max</span>
          <span className="ml-auto truncate font-medium">{facts.top.d.libelle}</span>
          <span className="shrink-0 font-semibold tabular-nums">{fmtPct(facts.top.part)}</span>
        </li>
        <li className="flex items-center gap-2">
          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          <span className="text-foreground/80">Participation min</span>
          <span className="ml-auto truncate font-medium">{facts.low.d.libelle}</span>
          <span className="shrink-0 font-semibold tabular-nums">{fmtPct(facts.low.part)}</span>
        </li>
      </ul>
    </div>
  );
}
