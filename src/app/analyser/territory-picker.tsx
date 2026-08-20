"use client";

import { useMemo, useState } from "react";
import { Crosshair, Search, X } from "lucide-react";
import { Input } from "@appica/ui-react/input";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import {
  searchEntries,
  entryLabel,
  useSearchIndex,
  type SearchEntry,
  type SearchEntryType,
} from "@/lib/search";
import {
  TERRITORY_LABELS,
  type TerritoryType,
} from "@/lib/territory-analysis";

/** Territoire sélectionné dans l'outil d'analyse. */
export type TerritorySel = { type: TerritoryType; code: string; label: string };

const ENTRY_TO_TYPE: Partial<Record<SearchEntryType, TerritoryType>> = {
  region: "region",
  departement: "departement",
  circo: "circo",
  commune: "commune",
};

const FILTERS: { id: TerritoryType | "tous"; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "commune", label: "Communes" },
  { id: "circo", label: "Circos" },
  { id: "departement", label: "Départements" },
  { id: "region", label: "Régions" },
];

/**
 * Sélecteur du territoire cible : recherche unique sur les 4 mailles (index
 * ⌘K), filtre facultatif par maille, raccourci vers la cible de campagne du QG.
 */
export function TerritoryPicker({
  value,
  campaign,
  onChange,
}: {
  value: TerritorySel | null;
  /** Cible de campagne du QG (raccourci « Ma cible »), si définie. */
  campaign: TerritorySel | null;
  onChange: (sel: TerritorySel) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TerritoryType | "tous">("tous");
  const index = useSearchIndex(true);

  const results = useMemo(() => {
    if (!index.data || query.trim().length < 1) return [];
    const picked: { entry: SearchEntry; type: TerritoryType }[] = [];
    for (const e of searchEntries(index.data, query, 80)) {
      const type = ENTRY_TO_TYPE[e.type];
      if (!type) continue; // députés : hors périmètre (territoires uniquement)
      if (filter !== "tous" && type !== filter) continue;
      picked.push({ entry: e, type });
      if (picked.length >= 9) break;
    }
    return picked;
  }, [index.data, query, filter]);

  function pick(entry: SearchEntry, type: TerritoryType) {
    onChange({ type, code: entry.code, label: entryLabel(entry) });
    setQuery("");
    setOpen(false);
  }

  const isCampaignSelected =
    !!campaign && !!value && campaign.type === value.type && campaign.code === value.code;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-3 shadow-card">
      <div className="relative min-w-0 flex-1 basis-60">
        <div className="flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Rechercher une commune, circonscription, département, région…"
            className="w-full text-[13px] placeholder:text-muted-foreground"
            aria-label="Rechercher un territoire" />
        </div>
        {open && results.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-80 w-full min-w-64 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
            {results.map(({ entry, type }) => (
              <li key={`${entry.type}-${entry.code}`}>
                <button
                  type="button"
                  onMouseDown={(ev) => { ev.preventDefault(); pick(entry, type); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] hover:bg-surface-soft"
                >
                  <span className="min-w-0 flex-1 truncate">{entry.nom}</span>
                  <span className="shrink-0 rounded-pill bg-surface-soft/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {TERRITORY_LABELS[type]}
                  </span>
                  <span className="w-14 shrink-0 text-right text-[10.5px] tabular-nums text-muted-foreground">
                    {entry.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="inline-flex items-center gap-0.5 rounded-pill bg-surface-soft/70 p-0.5">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              "rounded-pill px-2 py-1 text-[11px] font-medium transition-colors",
              filter === f.id
                ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(10,10,12,0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )} variant="ghost" size="sm">
            {f.label}
          </Button>
        ))}
      </div>

      {campaign && (
        <Button
          type="button"
          onClick={() => onChange(campaign)}
          disabled={isCampaignSelected}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
            isCampaignSelected
              ? "bg-warm/15 text-warm"
              : "bg-primary text-primary-foreground hover:opacity-90",
          )}
          title={campaign.label} variant="ghost" size="sm">
          <Crosshair className="h-3.5 w-3.5" /> Ma cible
        </Button>
      )}

      {value && (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-medium">
          <span className="truncate">{value.label}</span>
          <span className="shrink-0 text-[10.5px] font-normal text-muted-foreground">
            {TERRITORY_LABELS[value.type]}
          </span>
          {!isCampaignSelected && campaign && (
            <Button
              type="button"
              onClick={() => onChange(campaign)}
              aria-label="Revenir à ma cible de campagne" variant="ghost" size="sm">
              <X className="h-3 w-3" />
            </Button>
          )}
        </span>
      )}
    </div>
  );
}
