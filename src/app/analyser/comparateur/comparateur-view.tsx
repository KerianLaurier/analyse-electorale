"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { type Maille, MAILLE_LABELS } from "@/lib/map-config";
import { SCRUTIN_META, maillesFor, type Scrutin } from "@/lib/url-state";
import { useScrutinDetail } from "@/lib/queries";
import {
  useSearchIndex,
  searchEntries,
  type SearchEntry,
  type SearchEntryType,
} from "@/lib/search";

// Ordre chronologique des scrutins (un même territoire superposé dans le temps).
const TIMELINE: Scrutin[] = [
  "presid-2017-t1", "presid-2017-t2",
  "presid-2022-t1", "presid-2022-t2",
  "legis-2022-t1", "legis-2022-t2",
  "legis-2024-t1", "legis-2024-t2",
  "municipales-2026-t1", "municipales-2026-t2",
];

// Mailles disponibles dans l'index de recherche (⌘K).
const MAILLES: Maille[] = ["regions", "departements", "circonscriptions", "communes"];
const MAILLE_TO_TYPE: Record<string, SearchEntryType> = {
  regions: "region",
  departements: "departement",
  circonscriptions: "circo",
  communes: "commune",
};

const fmtPct = (v: number) =>
  `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

export function ComparateurView() {
  const [maille, setMaille] = useState<Maille>("departements");
  const [code, setCode] = useState<string>("59");
  const [name, setName] = useState<string>("Nord");

  const type = MAILLE_TO_TYPE[maille];
  const timeline = useMemo(() => TIMELINE.filter((s) => maillesFor(s).includes(maille)), [maille]);

  function pick(entry: SearchEntry) {
    setCode(entry.code);
    setName(entry.nom);
  }

  function changeMaille(m: Maille) {
    setMaille(m);
    setCode("");
    setName("");
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3 overflow-auto bg-canvas p-3">
      <div className="px-2 pt-2">
        <Link href="/analyser" className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Analyser
        </Link>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">Comparateur de scrutins</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Superposer tous les scrutins sur un même territoire pour repérer les bascules.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface p-4 shadow-card">
        <div className="inline-flex items-center gap-0.5 rounded-pill bg-surface-soft/70 p-0.5">
          {MAILLES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => changeMaille(m)}
              className={cn(
                "rounded-pill px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                maille === m
                  ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {MAILLE_LABELS[m]}
            </button>
          ))}
        </div>
        <span className="mx-1 h-5 w-px bg-border" />
        <TerritorySearch type={type} placeholder={`Rechercher ${labelFor(maille)}…`} onPick={pick} />
        {code && name && (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground">
            {name}
            <button type="button" onClick={() => { setCode(""); setName(""); }} aria-label="Effacer">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>

      {code ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
          {timeline.map((s) => (
            <ScrutinCard key={s} scrutin={s} maille={maille} code={code} />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[300px] place-items-center rounded-lg bg-surface p-8 text-center shadow-card">
          <div>
            <Search className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-[13px] font-medium">Choisis un territoire</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Sélectionne une maille puis recherche {labelFor(maille)}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function labelFor(maille: Maille): string {
  switch (maille) {
    case "regions": return "une région";
    case "departements": return "un département";
    case "circonscriptions": return "une circonscription";
    default: return "une commune";
  }
}

function TerritorySearch({
  type,
  placeholder,
  onPick,
}: {
  type: SearchEntryType;
  placeholder: string;
  onPick: (e: SearchEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const index = useSearchIndex(true);

  const results = useMemo(() => {
    if (!index.data || query.trim().length < 1) return [];
    return searchEntries(index.data, query, 60).filter((e) => e.type === type).slice(0, 8);
  }, [index.data, query, type]);

  return (
    <div className="relative">
      <div className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-52 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
          {results.map((e) => (
            <li key={`${e.type}-${e.code}`}>
              <button
                type="button"
                onMouseDown={(ev) => { ev.preventDefault(); onPick(e); setQuery(e.nom); setOpen(false); }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-surface-soft"
              >
                <span className="truncate">{e.nom}</span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                  {e.departement ? `${e.departement} · ${e.code}` : e.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScrutinCard({ scrutin, maille, code }: { scrutin: Scrutin; maille: Maille; code: string }) {
  const detail = useScrutinDetail(scrutin, maille, code);
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
        <p className="text-[11px] text-muted-foreground">Indisponible</p>
      )}
    </div>
  );
}
