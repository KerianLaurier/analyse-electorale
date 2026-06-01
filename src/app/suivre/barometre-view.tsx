"use client";

import { useMemo, useState } from "react";
import { Loader2, ExternalLink, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePolls2027, buildSeries, candidateColor, candidateShort, type SeriesPoint } from "@/lib/polls";

// Géométrie du graphe (viewBox responsive). Marge droite large = place pour les
// étiquettes en bout de courbe (bien plus lisible qu'une légende de couleurs).
const W = 880;
const H = 380;
const PAD = { l: 32, r: 132, t: 20, b: 30 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const fmtMonth = (d: Date) => `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;

export function BarometreView() {
  const { data, isLoading, error } = usePolls2027();

  const instituts = useMemo(() => {
    if (!data) return [] as string[];
    const counts = new Map<string, number>();
    for (const p of data.polls) counts.set(p.sondeur, (counts.get(p.sondeur) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [data]);

  // Fenêtre « dernière année » : 12 mois avant le sondage le plus récent.
  const since = useMemo(() => {
    if (!data || data.polls.length === 0) return undefined;
    const max = data.polls.reduce((m, p) => (p.date > m ? p.date : m), data.polls[0].date);
    const d = new Date(max);
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, [data]);

  const [institut, setInstitut] = useState<string | null>(null);
  const inst = institut ?? instituts[0] ?? null;
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const series = useMemo<Map<string, SeriesPoint[]>>(
    () => (data && inst ? buildSeries(data.polls, inst, since) : new Map<string, SeriesPoint[]>()),
    [data, inst, since],
  );

  // Candidats affichés : ≥ 2 points sur l'année, triés par dernière valeur, top 8.
  const shown = useMemo(() => {
    return [...series.entries()]
      .filter(([, pts]) => pts.length >= 2)
      .map(([cand, pts]) => ({ cand, pts, last: pts[pts.length - 1].value }))
      .sort((a, b) => b.last - a.last)
      .slice(0, 8);
  }, [series]);

  const geo = useMemo(() => {
    const visible = shown.filter((s) => !hidden.has(s.cand));
    const allPts = visible.flatMap((s) => s.pts);
    if (allPts.length < 2) return null;
    const times = allPts.map((p) => new Date(p.date).getTime());
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const vMax = Math.max(5, ...allPts.map((p) => p.value));
    const yMax = Math.ceil(vMax / 5) * 5;
    const step = yMax <= 25 ? 5 : 10;
    const x = (iso: string) => PAD.l + (tMax === tMin ? 0.5 : (new Date(iso).getTime() - tMin) / (tMax - tMin)) * PW;
    const y = (v: number) => PAD.t + PH - (v / yMax) * PH;

    // Ticks X : un par mois, libellé tous les 2 mois (évite l'encombrement).
    const ticks: { x: number; label: string | null }[] = [];
    const cur = new Date(tMin);
    cur.setDate(1);
    const end = new Date(tMax);
    let i = 0;
    while (cur <= end) {
      ticks.push({ x: x(cur.toISOString().slice(0, 10)), label: i % 2 === 0 ? fmtMonth(cur) : null });
      cur.setMonth(cur.getMonth() + 1);
      i++;
    }

    // Étiquettes de fin : on écarte verticalement celles qui se chevauchent.
    const labels = visible
      .map((s) => ({ cand: s.cand, color: candidateColor(s.cand), value: s.last, y: y(s.last) }))
      .sort((a, b) => a.y - b.y);
    const GAP = 15;
    for (let k = 1; k < labels.length; k++) {
      if (labels[k].y < labels[k - 1].y + GAP) labels[k].y = labels[k - 1].y + GAP;
    }
    // Si on déborde en bas, on remonte la pile.
    const overflow = labels.length ? labels[labels.length - 1].y - (PAD.t + PH) : 0;
    if (overflow > 0) for (const l of labels) l.y -= overflow;

    return { visible, yMax, step, x, y, ticks, labels };
  }, [shown, hidden]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement du baromètre…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        Baromètre indisponible.
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 overflow-auto rounded-lg bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Présidentielle 2027 · 1er tour · 12 derniers mois</p>
          <h2 className="mt-0.5 text-[20px] font-semibold tracking-tight">Évolution des intentions de vote</h2>
          <p className="mt-1 inline-flex items-start gap-1 text-[11.5px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Une seule maison de sondage à la fois — pour éviter de mélanger les effets de maison.
          </p>
        </div>
      </div>

      {/* Sélecteur d'institut */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {instituts.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => { setInstitut(n); setHidden(new Set()); }}
            className={cn(
              "rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
              n === inst ? "bg-primary text-primary-foreground" : "bg-black/[0.04] text-foreground/80 hover:bg-black/[0.08]",
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Graphe */}
      {!geo ? (
        <p className="mt-10 text-center text-[13px] text-muted-foreground">
          Pas assez de sondages {inst} sur les 12 derniers mois pour tracer une courbe.
        </p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full" role="img" aria-label={`Intentions de vote — ${inst}, 12 derniers mois`}>
            {/* Gradations Y */}
            {Array.from({ length: geo.yMax / geo.step + 1 }).map((_, i) => {
              const v = i * geo.step;
              const yy = geo.y(v);
              return (
                <g key={v}>
                  <line x1={PAD.l} y1={yy} x2={W - PAD.r} y2={yy} stroke="currentColor" className="text-border/55" strokeWidth={1} />
                  <text x={PAD.l - 7} y={yy + 3.5} textAnchor="end" className="fill-muted-foreground/80 text-[10px] tabular-nums">{v}</text>
                </g>
              );
            })}
            {/* Ticks X (mois) */}
            {geo.ticks.map((t, i) => (
              <g key={i}>
                <line x1={t.x} y1={PAD.t} x2={t.x} y2={PAD.t + PH} stroke="currentColor" className="text-border/30" strokeWidth={t.label ? 1 : 0} />
                {t.label && (
                  <text x={t.x} y={H - 9} textAnchor="middle" className="fill-muted-foreground/80 text-[10px]">{t.label}</text>
                )}
              </g>
            ))}
            {/* Courbes */}
            {geo.visible.map(({ cand, pts }) => {
              const color = candidateColor(cand);
              const last = pts[pts.length - 1];
              const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${geo.x(p.date).toFixed(1)},${geo.y(p.value).toFixed(1)}`).join(" ");
              return (
                <g key={cand}>
                  <path d={d} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p, i) => (
                    <circle key={i} cx={geo.x(p.date)} cy={geo.y(p.value)} r={i === pts.length - 1 ? 3.5 : 2} fill={color} stroke="var(--surface, #fff)" strokeWidth={i === pts.length - 1 ? 1.5 : 0} />
                  ))}
                  {/* Trait de liaison vers l'étiquette */}
                  <line
                    x1={geo.x(last.date)}
                    y1={geo.y(last.value)}
                    x2={W - PAD.r + 8}
                    y2={geo.labels.find((l) => l.cand === cand)?.y ?? geo.y(last.value)}
                    stroke={color}
                    strokeWidth={1}
                    className="opacity-40"
                  />
                </g>
              );
            })}
            {/* Étiquettes en bout de courbe (écartées si chevauchement) */}
            {geo.labels.map((l) => (
              <text key={l.cand} x={W - PAD.r + 12} y={l.y + 3.5} className="text-[11px]" fill={l.color}>
                <tspan className="font-semibold">{candidateShort(l.cand)}</tspan>
                <tspan className="font-bold tabular-nums"> {l.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</tspan>
              </text>
            ))}
          </svg>

          {/* Filtres candidats (afficher / masquer) */}
          <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5">
            {shown.map(({ cand }) => {
              const off = hidden.has(cand);
              return (
                <button
                  key={cand}
                  type="button"
                  onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(cand)) n.delete(cand); else n.add(cand); return n; })}
                  className={cn("inline-flex items-center gap-1.5 text-[12px] transition-opacity hover:opacity-100", off ? "opacity-35" : "opacity-90")}
                  aria-pressed={!off}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: candidateColor(cand) }} />
                  {candidateShort(cand)}
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-5 text-[10.5px] text-muted-foreground/70">
        Source :{" "}
        <a href={data.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-warm hover:underline">
          Wikipédia <ExternalLink className="h-3 w-3" />
        </a>{" "}
        (agrégation des sondages publiés). Chaque point = une vague (moyenne des hypothèses publiées ce jour-là).
      </p>
    </div>
  );
}
