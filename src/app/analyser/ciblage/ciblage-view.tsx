"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Crosshair, Loader2, MapPin, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCircoList, useCircoTargeting, type TargetBureau } from "@/lib/queries";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtPct = (n: number, d = 1) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

function priorityClass(p: number): string {
  if (p >= 66) return "bg-red-500";
  if (p >= 40) return "bg-amber-500";
  return "bg-slate-400";
}

export function CiblageView() {
  const params = useSearchParams();
  const router = useRouter();
  const circo = params.get("circo");
  const list = useCircoList();
  const targeting = useCircoTargeting(circo);

  const rows = targeting.data ?? [];
  const totalInscrits = rows.reduce((s, b) => s + b.inscrits, 0);
  const avgAbst = rows.length ? rows.reduce((s, b) => s + b.abstentionRate, 0) / rows.length : 0;
  const circoLabel = list.data?.find((c) => c.code === circo)?.libelle;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/analyser" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Analyser
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-3 border-b border-black/5 pb-5">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Crosshair className="h-3.5 w-3.5" /> Ciblage terrain
          </p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight">Bureaux prioritaires</h1>
          <p className="text-[12.5px] text-muted-foreground">
            Où concentrer le porte-à-porte : réservoir d’abstention, marginalité et taille des bureaux.
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Circonscription</span>
          <select
            value={circo ?? ""}
            onChange={(e) => router.push(e.target.value ? `/analyser/ciblage?circo=${e.target.value}` : "/analyser/ciblage")}
            className="min-w-[240px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20"
          >
            <option value="">Choisir une circonscription…</option>
            {(list.data ?? []).map((c) => (
              <option key={c.code} value={c.code}>{c.code} · {c.libelle}</option>
            ))}
          </select>
        </label>
      </header>

      {!circo ? (
        <Empty>Choisissez une circonscription pour classer ses bureaux par priorité.</Empty>
      ) : targeting.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>
          Aucun bureau exploitable pour cette circonscription. Les circos dont les communes sont
          partagées entre plusieurs circonscriptions ne sont pas détaillées au bureau.
        </Empty>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KPI label="Bureaux" value={fmtInt(rows.length)} />
            <KPI label="Inscrits" value={fmtInt(totalInscrits)} />
            <KPI label="Abstention moy." value={fmtPct(avgAbst, 0)} />
            <KPI label="Top priorité" value={rows[0]?.name ?? "—"} small />
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md bg-warm/[0.08] px-3 py-2 text-[11.5px] text-foreground/75">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
            <span>
              Score de priorité (0–100) = réservoir d’abstention (45 %) + marginalité, écart 1<sup>er</sup>/2<sup>e</sup> faible (35 %)
              + taille en inscrits (20 %), normalisés sur la circonscription. Source : Législatives 2024 · 1<sup>er</sup> tour.
            </span>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-black/5 bg-surface shadow-card">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Bureau</th>
                  <th className="px-3 py-2 font-medium text-right">Inscrits</th>
                  <th className="px-3 py-2 font-medium text-right">Abstention</th>
                  <th className="px-3 py-2 font-medium text-right">Écart 1<sup>er</sup>/2<sup>e</sup></th>
                  <th className="px-3 py-2 font-medium">Tête</th>
                  <th className="px-3 py-2 font-medium">Priorité</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b, i) => (
                  <Row key={b.code} b={b} rank={i + 1} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ b, rank }: { b: TargetBureau; rank: number }) {
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{rank}</td>
      <td className="px-3 py-2">
        <Link href={`/bureau/${encodeURIComponent(b.code)}`} className="font-medium hover:text-warm">
          {b.name}
        </Link>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(b.inscrits)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtPct(b.abstentionRate, 0)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{b.marginPct == null ? "—" : fmtPct(b.marginPct, 1)}</td>
      <td className="px-3 py-2">
        {b.winnerNuance ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: nuanceColor(b.winnerNuance) }} />
            <span className="truncate" style={{ color: nuanceColor(b.winnerNuance) }}>{nuanceLabel(b.winnerNuance)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-black/[0.06]">
            <div className={cn("h-full rounded-full", priorityClass(b.priority))} style={{ width: `${b.priority}%` }} />
          </div>
          <span className="w-6 tabular-nums font-semibold">{b.priority}</span>
        </div>
      </td>
    </tr>
  );
}

function KPI({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-black/5 bg-surface p-3 shadow-card">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-semibold tabular-nums tracking-tight", small ? "truncate text-[13px]" : "text-[16px]")}>{value}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Calcul du ciblage…
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-dashed border-black/10 bg-surface/60 px-6 py-14 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-pill bg-warm/15 text-warm">
        <MapPin className="h-5 w-5" />
      </span>
      <p className="max-w-md text-[13px] text-muted-foreground">{children}</p>
    </div>
  );
}
