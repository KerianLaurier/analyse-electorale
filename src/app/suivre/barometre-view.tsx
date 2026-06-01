"use client";

import { useMemo, useState } from "react";
import { Loader2, ExternalLink, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePolls2027, buildSeries, candidateColor, candidateShort, type SeriesPoint } from "@/lib/polls";

// Géométrie du graphe (viewBox responsive).
const W = 760;
const H = 320;
const PAD = { l: 34, r: 14, t: 14, b: 26 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

export function BarometreView() {
  const { data, isLoading, error } = usePolls2027();

  const instituts = useMemo(() => {
    if (!data) return [] as string[];
    const counts = new Map<string, number>();
    for (const p of data.polls) counts.set(p.sondeur, (counts.get(p.sondeur) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [data]);

  const [institut, setInstitut] = useState<string | null>(null);
  const inst = institut ?? instituts[0] ?? null;
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const series = useMemo<Map<string, SeriesPoint[]>>(
    () => (data && inst ? buildSeries(data.polls, inst) : new Map<string, SeriesPoint[]>()),
    [data, inst],
  );

  // Candidats affichés : ≥ 2 points, triés par dernière valeur, top 8.
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
    const vMax = Math.max(10, ...allPts.map((p) => p.value));
    const yMax = Math.ceil(vMax / 10) * 10;
    const x = (iso: string) => PAD.l + (tMax === tMin ? 0.5 : (new Date(iso).getTime() - tMin) / (tMax - tMin)) * PW;
    const y = (v: number) => PAD.t + PH - (v / yMax) * PH;
    // ticks d'années présentes
    const years = [...new Set(allPts.map((p) => p.date.slice(0, 4)))].sort();
    return { visible, tMin, tMax, yMax, x, y, years };
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
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Présidentielle 2027 · 1er tour</p>
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
        <p className="mt-8 text-center text-[13px] text-muted-foreground">
          Pas assez de points pour tracer une courbe avec {inst}.
        </p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={`Intentions de vote — ${inst}`}>
            {/* Gradations Y */}
            {Array.from({ length: geo.yMax / 10 + 1 }).map((_, i) => {
              const v = i * 10;
              const yy = geo.y(v);
              return (
                <g key={v}>
                  <line x1={PAD.l} y1={yy} x2={W - PAD.r} y2={yy} stroke="currentColor" className="text-border/60" strokeWidth={1} />
                  <text x={PAD.l - 6} y={yy + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{v}</text>
                </g>
              );
            })}
            {/* Ticks X (années) */}
            {geo.years.map((yr) => {
              const xx = geo.x(`${yr}-06-30`);
              return (
                <text key={yr} x={xx} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[9px]">{yr}</text>
              );
            })}
            {/* Courbes */}
            {geo.visible.map(({ cand, pts }) => {
              const color = candidateColor(cand);
              const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${geo.x(p.date).toFixed(1)},${geo.y(p.value).toFixed(1)}`).join(" ");
              return (
                <g key={cand}>
                  <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p, i) => (
                    <circle key={i} cx={geo.x(p.date)} cy={geo.y(p.value)} r={2} fill={color} />
                  ))}
                </g>
              );
            })}
          </svg>

          {/* Légende (cliquable) */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {shown.map(({ cand, last }) => {
              const off = hidden.has(cand);
              return (
                <button
                  key={cand}
                  type="button"
                  onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(cand)) n.delete(cand); else n.add(cand); return n; })}
                  className={cn("inline-flex items-center gap-1.5 text-[12px] transition-opacity", off && "opacity-35")}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: candidateColor(cand) }} />
                  {candidateShort(cand)}
                  <span className="font-semibold tabular-nums">{last.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-5 text-[10.5px] text-muted-foreground/70">
        {data.n_polls} sondages · {data.instituts.length} instituts ·{" "}
        <a href={data.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-warm hover:underline">
          source : Wikipédia <ExternalLink className="h-3 w-3" />
        </a>{" "}
        (agrégation). Moyenne des hypothèses d’une même vague.
      </p>
    </div>
  );
}
