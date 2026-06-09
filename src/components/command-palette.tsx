"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, Building2, Map, Vote, Loader2, ArrowRight, UserRound, Star, Users } from "lucide-react";
import { usePins } from "@/lib/pins";
import { toast } from "@/components/toaster";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  type SearchEntry,
  type SearchEntryType,
  TYPE_LABELS,
  mailleForType,
  searchEntries,
  useSearchIndex,
} from "@/lib/search";

const TYPE_ICON: Record<SearchEntryType, typeof MapPin> = {
  region: Map,
  departement: Map,
  circo: Vote,
  commune: Building2,
  depute: UserRound,
};

// Navigation rapide (toujours dispo, en bas de la palette).
const NAV_SHORTCUTS = [
  { href: "/explorer", label: "Ouvrir l'explorateur" },
  { href: "/analyser/simulateur", label: "Simulateur législatif" },
  { href: "/analyser/marginalite", label: "Carte des sièges marginaux" },
  { href: "/suivre", label: "Briefing du jour" },
  { href: "/suivre?s=medias", label: "Veille médias & territoire" },
  { href: "/suivre?s=opinion", label: "Sondages & baromètre" },
  { href: "/suivre?s=parlement", label: "Votes & lois (AN)" },
  { href: "/suivre?s=echeances", label: "Agenda électoral" },
  { href: "/suivre/parrainages", label: "Parrainages 2027" },
  { href: "/suivre/soiree", label: "Soirée électorale" },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  // Préchargement de l'index (~2,7 Mo) pendant un temps creux : la première
  // recherche ⌘K répond instantanément. Pages applicatives seulement — pas de
  // téléchargement inutile sur la vitrine ni les écrans d'auth.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (warm || pathname === "/" || pathname.startsWith("/auth/")) return;
    const idle = window.requestIdleCallback?.(() => setWarm(true), { timeout: 5000 });
    const fallback = idle === undefined ? window.setTimeout(() => setWarm(true), 2500) : undefined;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (fallback !== undefined) window.clearTimeout(fallback);
    };
  }, [pathname, warm]);

  const indexQuery = useSearchIndex(open || warm);
  const pins = usePins();
  const results = useMemo<SearchEntry[]>(() => {
    if (!query || !indexQuery.data) return [];
    return searchEntries(indexQuery.data, query, 30);
  }, [query, indexQuery.data]);

  const groups = useMemo(() => {
    const map = new globalThis.Map<SearchEntryType, SearchEntry[]>();
    for (const e of results) {
      const arr = map.get(e.type) ?? [];
      arr.push(e);
      map.set(e.type, arr);
    }
    return map;
  }, [results]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "f" && !event.metaKey && !event.ctrlKey) {
        const target = event.target as HTMLElement | null;
        const isEditable =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.tagName === "SELECT" ||
          target?.isContentEditable;
        if (!isEditable) {
          event.preventDefault();
          const active = document.documentElement.classList.toggle("focus-mode");
          // Un appui accidentel masque tout le chrome : on explique comment sortir.
          if (active) toast.info("Mode focus activé — appuyez sur F pour quitter.");
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function openEntry(entry: SearchEntry) {
    // On ouvre directement la fiche du territoire/personne quand elle existe
    // (plus lisible qu'un simple surlignage sur la carte). Région & département
    // n'ont pas de fiche dédiée → on retombe sur l'explorateur centré.
    switch (entry.type) {
      case "depute":
        return go(`/elu/${encodeURIComponent(entry.code)}`);
      case "commune":
        return go(`/commune/${encodeURIComponent(entry.code)}`);
      case "circo":
        return go(`/circo/${encodeURIComponent(entry.code)}`);
      default: {
        const params = new URLSearchParams({ maille: mailleForType(entry.type), code: entry.code });
        return go(`/explorer?${params.toString()}`);
      }
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Recherche universelle"
      description="Saisissez une commune, une circonscription, un département ou une région."
    >
      <Command shouldFilter={false}>
      <CommandInput
        placeholder="Rechercher commune, circonscription, département, député…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.length === 0 && (
          <>
            {pins.length > 0 && (
              <CommandGroup heading="Épinglés">
                {pins.slice(0, 8).map((p) => (
                  <CommandItem
                    key={`${p.type}-${p.id}`}
                    value={`pin-${p.type}-${p.id}-${p.label}`}
                    onSelect={() => go(p.href)}
                  >
                    {p.shared ? (
                      <Users className="h-4 w-4 text-warm" />
                    ) : (
                      <Star className="h-4 w-4 fill-warm text-warm" />
                    )}
                    <span className="flex-1 truncate">{p.label}</span>
                    {p.shared && (
                      <span className="ml-2 shrink-0 rounded-full bg-warm/15 px-1.5 py-0.5 text-[10px] font-medium text-warm">
                        Équipe
                      </span>
                    )}
                    {p.sublabel && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{p.sublabel}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Navigation">
              {NAV_SHORTCUTS.map((s) => (
                <CommandItem
                  key={s.href}
                  value={`nav-${s.href}`}
                  onSelect={() => go(s.href)}
                >
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {s.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="px-3 py-2 text-[11px] text-muted-foreground/80">
              Recherchez parmi {indexQuery.data?.length ?? "…"}{" "}
              territoires et députés en exercice.
            </div>
          </>
        )}

        {query.length > 0 && indexQuery.isLoading && (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Chargement de l&apos;index…
          </div>
        )}

        {query.length > 0 && !indexQuery.isLoading && results.length === 0 && (
          <CommandEmpty>Aucun résultat.</CommandEmpty>
        )}

        {Array.from(groups.entries()).map(([type, items], i) => {
          const Icon = TYPE_ICON[type];
          return (
            <div key={type}>
              {i > 0 && <CommandSeparator />}
              <CommandGroup heading={`${TYPE_LABELS[type]}s`}>
                {items.map((e) => (
                  <CommandItem
                    key={`${e.type}-${e.code}`}
                    value={`${e.type}-${e.code}-${e.nom}`}
                    onSelect={() => openEntry(e)}
                  >
                    {e.type === "depute" && e.groupeColor ? (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: e.groupeColor }}
                        aria-hidden
                      />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{e.nom}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {e.type === "depute"
                        ? `${e.groupe ?? ""} · circ. ${e.code}`
                        : e.departement
                          ? `${e.departement} · ${e.code}`
                          : e.code}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
