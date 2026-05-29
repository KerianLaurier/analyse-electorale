"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { SCRUTIN_META, type Scrutin } from "@/lib/url-state";
import { useScrutinDetail } from "@/lib/queries";
import { useParticipationByMaille } from "@/lib/analysis";

// Ordre chronologique des scrutins (un même territoire superposé dans le temps).
const TIMELINE: Scrutin[] = [
  "presid-2017-t1",
  "presid-2017-t2",
  "presid-2022-t1",
  "presid-2022-t2",
  "legis-2022-t1",
  "legis-2022-t2",
  "legis-2024-t1",
  "legis-2024-t2",
  "municipales-2026-t1",
  "municipales-2026-t2",
];

const fmtPct = (v: number) =>
  `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

export function ComparateurView() {
  // Liste des départements (code + libellé) depuis un scrutin de référence.
  const depts = useParticipationByMaille("presid-2022-t1", "departements", true);
  const options = useMemo(
    () =>
      (depts.data ?? [])
        .filter((d) => d.libelle)
        .sort((a, b) => (a.libelle ?? "").localeCompare(b.libelle ?? "")),
    [depts.data],
  );

  const [code, setCode] = useState<string>("");
  useEffect(() => {
    if (!code && options.length) {
      setCode(options.find((o) => o.code === "59")?.code ?? options[0].code);
    }
  }, [options, code]);

  const deptName = options.find((o) => o.code === code)?.libelle ?? code;

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3 overflow-auto bg-canvas p-3">
      <div className="flex items-end justify-between gap-4 px-2 pt-2">
        <div>
          <Link href="/analyser" className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Analyser
          </Link>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">Comparateur de scrutins</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Superposer tous les scrutins sur un même département pour repérer les bascules.
          </p>
        </div>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-pill bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground outline-none"
        >
          {options.map((o) => (
            <option key={o.code} value={o.code} className="bg-surface text-foreground">
              {o.libelle}
            </option>
          ))}
        </select>
      </div>

      <p className="px-2 text-[13px] font-medium">{deptName}</p>

      {code && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
          {TIMELINE.map((s) => (
            <ScrutinCard key={s} scrutin={s} code={code} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScrutinCard({ scrutin, code }: { scrutin: Scrutin; code: string }) {
  const detail = useScrutinDetail(scrutin, "departements", code);
  const top = detail.data?.candidates.slice(0, 3) ?? [];
  const winner = top[0];
  const max = Math.max(...top.map((c) => c.pct), 0.0001);

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-3 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {SCRUTIN_META[scrutin].short}
      </p>
      {detail.isFetching && !detail.data ? (
        <div className="h-16 animate-pulse rounded bg-black/[0.05]" />
      ) : winner ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: nuanceColor(winner.nuance) }} />
              <span className="truncate" title={winner.label || nuanceLabel(winner.nuance)}>
                {winner.label || nuanceLabel(winner.nuance)}
              </span>
            </span>
            <span className="shrink-0 text-[14px] font-semibold tabular-nums">{fmtPct(winner.pct)}</span>
          </div>
          <div className="flex flex-col gap-1">
            {top.map((c, i) => (
              <div key={`${c.label}-${i}`} className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-soft/60">
                  <span className="block h-full rounded-pill" style={{ width: `${(c.pct / max) * 100}%`, background: nuanceColor(c.nuance) }} />
                </div>
                <span className="w-10 shrink-0 text-right text-[10.5px] tabular-nums text-muted-foreground">{fmtPct(c.pct)}</span>
              </div>
            ))}
          </div>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">
            Participation {detail.data ? fmtPct(detail.data.participation) : "—"}
          </p>
        </>
      ) : (
        <p className={cn("text-[11px] text-muted-foreground")}>Indisponible</p>
      )}
    </div>
  );
}
