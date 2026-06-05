"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Crosshair, Loader2, MapPin, Info, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCircoList, useCircoBureaux, scoreBureaux, type TargetBureau, type TargetReason } from "@/lib/queries";
import { BLOCS, blocById, type BlocId } from "@/lib/analysis";
import { useHasTeam, addSectorsBulk } from "@/lib/campaign";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { ErrorState } from "@/components/error-state";
import { InlineLoading } from "@/components/inline-loading";
import { fmtInt, fmtPct } from "@/lib/format";


const REASON: Record<TargetReason, { label: string; className: string } | null> = {
  bascule: { label: "Bascule à portée", className: "bg-amber-100 text-amber-700" },
  bastion: { label: "Bastion à mobiliser", className: "bg-emerald-100 text-emerald-700" },
  conquete: { label: "À conquérir", className: "bg-sky-100 text-sky-700" },
  reservoir: { label: "Réservoir d’abstention", className: "bg-warm/15 text-warm" },
  dispute: { label: "Très disputé", className: "bg-amber-100 text-amber-700" },
  defavorable: { label: "Peu favorable", className: "bg-surface-soft text-muted-foreground" },
  neutre: null,
};

function priorityClass(p: number): string {
  if (p >= 66) return "bg-red-500";
  if (p >= 40) return "bg-amber-500";
  return "bg-slate-400";
}

const BLOC_KEY = "mvc:ciblage:bloc";

export function CiblageView() {
  const params = useSearchParams();
  const router = useRouter();
  const circo = params.get("circo");
  const list = useCircoList();
  const raw = useCircoBureaux(circo);

  const [bloc, setBloc] = useState<BlocId | "">(() => {
    if (typeof window === "undefined") return "";
    return (localStorage.getItem(BLOC_KEY) as BlocId | "") || "";
  });
  function changeBloc(v: BlocId | "") {
    setBloc(v);
    try {
      localStorage.setItem(BLOC_KEY, v);
    } catch {
      /* quota / indispo */
    }
  }

  const rows = useMemo<TargetBureau[]>(
    () => (raw.data ? scoreBureaux(raw.data, bloc || null) : []),
    [raw.data, bloc],
  );

  const hasTeam = useHasTeam();
  const [pushing, setPushing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function pushToPlan() {
    if (pushing || rows.length === 0) return;
    setPushing(true);
    setNotice(null);
    const added = await addSectorsBulk(
      rows.map((b) => ({ name: b.name, registered: b.inscrits, bureauCode: b.code, priority: b.priority })),
    );
    setPushing(false);
    setNotice(
      added > 0
        ? `${added} bureau${added > 1 ? "x" : ""} ajouté${added > 1 ? "s" : ""} au plan de terrain du QG (onglet Campagne).`
        : "Ces bureaux sont déjà dans votre plan de terrain.",
    );
  }

  const totalInscrits = rows.reduce((s, b) => s + b.inscrits, 0);
  const avgAbst = rows.length ? rows.reduce((s, b) => s + b.abstentionRate, 0) / rows.length : 0;
  const favorables = rows.filter((b) => b.reason === "bastion" || b.reason === "bascule" || b.reason === "conquete").length;
  const blocMeta = bloc ? blocById(bloc) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/analyser" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Analyser
      </Link>

      <header className="mt-3 border-b border-foreground/5 pb-5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Crosshair className="h-3.5 w-3.5" /> Ciblage terrain
        </p>
        <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight">Bureaux prioritaires</h1>
        <p className="text-[12.5px] text-muted-foreground">
          Où concentrer le porte-à-porte, en fonction de votre positionnement.
        </p>

        <div className="mt-3 flex flex-wrap gap-3">
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
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Mon positionnement</span>
            <select
              value={bloc}
              onChange={(e) => changeBloc(e.target.value as BlocId | "")}
              className="min-w-[200px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20"
            >
              <option value="">Indifférent (générique)</option>
              {BLOCS.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {!circo ? (
        <Empty>Choisissez une circonscription et votre positionnement pour classer ses bureaux par priorité.</Empty>
      ) : raw.isError ? (
        <ErrorState
          className="mt-6"
          message="Impossible de charger les bureaux de cette circonscription."
          onRetry={() => void raw.refetch()}
        />
      ) : raw.isLoading ? (
        <InlineLoading label="Calcul du ciblage…" />
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
            {blocMeta ? (
              <KPI label="Bureaux favorables" value={fmtInt(favorables)} />
            ) : (
              <KPI label="Abstention moy." value={fmtPct(avgAbst, 0)} />
            )}
            <KPI label="Top priorité" value={rows[0]?.name ?? "—"} small />
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md bg-warm/[0.08] px-3 py-2 text-[11.5px] text-foreground/75">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
            <span>
              {blocMeta ? (
                <>
                  Priorité pour <span className="font-medium" style={{ color: blocMeta.color }}>{blocMeta.label}</span> = compétitivité du
                  bloc, proche de gagner (45 %) + base à mobiliser, part du bloc × abstention (35 %) + taille (20 %). Un bureau ancré
                  contre votre camp est déprioritisé.
                </>
              ) : (
                <>Score générique = réservoir d’abstention (45 %) + marginalité (35 %) + taille (20 %). Choisissez un positionnement pour un ciblage politique.</>
              )}
              {" "}Source : Législatives 2024 · 1<sup>er</sup> tour.
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-muted-foreground">
              {rows.length} bureaux classés{blocMeta ? ` pour ${blocMeta.label}` : ""}.
            </p>
            {hasTeam ? (
              <button
                type="button"
                onClick={pushToPlan}
                disabled={pushing}
                className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Ajouter au plan de terrain
              </button>
            ) : (
              <Link href="/auth/team" className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3.5 py-1.5 text-[12px] font-medium text-foreground/80 hover:bg-surface-soft">
                Créer une équipe pour un plan de terrain
              </Link>
            )}
          </div>

          {notice && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{notice}</span>
            </div>
          )}

          <div className="mt-3 overflow-x-auto rounded-lg border border-foreground/5 bg-surface shadow-card">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Bureau</th>
                  <th className="px-3 py-2 font-medium text-right">Inscrits</th>
                  <th className="px-3 py-2 font-medium text-right">Abstention</th>
                  <th className="px-3 py-2 font-medium text-right">{blocMeta ? `Part ${blocMeta.label.split(" ")[0]}` : "Écart 1er/2e"}</th>
                  <th className="px-3 py-2 font-medium">Tête</th>
                  <th className="px-3 py-2 font-medium">Priorité</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b, i) => (
                  <Row key={b.code} b={b} rank={i + 1} blocMode={!!blocMeta} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ b, rank, blocMode }: { b: TargetBureau; rank: number; blocMode: boolean }) {
  const reason = REASON[b.reason];
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-3 py-2 tabular-nums text-muted-foreground">{rank}</td>
      <td className="px-3 py-2">
        <Link href={`/bureau/${encodeURIComponent(b.code)}`} className="font-medium hover:text-warm">
          {b.name}
        </Link>
        {reason && (
          <span className={cn("ml-2 rounded-pill px-1.5 py-0.5 text-[10px] font-medium align-middle", reason.className)}>{reason.label}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(b.inscrits)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtPct(b.abstentionRate, 0)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {blocMode ? (b.blocShare == null ? "—" : fmtPct(b.blocShare, 1)) : b.marginPct == null ? "—" : fmtPct(b.marginPct, 1)}
      </td>
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
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-foreground/[0.06]">
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
    <div className="rounded-xl border border-foreground/5 bg-surface p-3 shadow-card">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-semibold tabular-nums tracking-tight", small ? "truncate text-[13px]" : "text-[16px]")}>{value}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-2 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-6 py-14 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-pill bg-warm/15 text-warm">
        <MapPin className="h-5 w-5" />
      </span>
      <p className="max-w-md text-[13px] text-muted-foreground">{children}</p>
    </div>
  );
}
