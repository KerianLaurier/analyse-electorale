"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Vote,
  FileText,
  CalendarDays,
  Search,
  Loader2,
  ExternalLink,
  Building2,
  Calendar,
  Flag,
  Landmark,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useNotices,
  cleanLabel,
  formatDateFr,
  relativeFr,
  type Notice,
  type ScrutinCode,
} from "@/lib/sondages";
import {
  useVotesAN,
  useLois,
  useAgenda,
  useVeille,
  type VoteAN,
  type Loi,
  type LoiStep,
  type AgendaEvent,
  type Article,
} from "@/lib/suivi";

// ═══════════════════════════════════════════════════════════════════════════
//  Catégories de suivi
// ═══════════════════════════════════════════════════════════════════════════

const PER_PAGE = 12;

/** Pagine un tableau ; reset à la page 0 quand le contenu change (filtres). */
function usePaged<T>(items: T[]) {
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [items]);
  const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = items.slice(
    safePage * PER_PAGE,
    safePage * PER_PAGE + PER_PAGE,
  );
  return { pageItems, page: safePage, setPage, pageCount, total: items.length };
}

type Category = "actualite" | "sondages" | "votes" | "lois" | "agenda";

const CATEGORIES: { id: Category; label: string; icon: typeof Vote }[] = [
  { id: "actualite", label: "Actualité", icon: Newspaper },
  { id: "sondages", label: "Sondages", icon: BarChart3 },
  { id: "votes", label: "Votes AN", icon: Vote },
  { id: "lois", label: "Lois & PPL", icon: FileText },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
];

export function SuivreView() {
  const [category, setCategory] = useState<Category>("actualite");

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full min-w-0 gap-3 overflow-hidden bg-canvas p-3">
      {/* Rail catégories (commun) */}
      <nav className="flex w-[180px] shrink-0 flex-col gap-1 rounded-lg bg-surface p-3 shadow-card">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Suivi
        </p>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-surface-soft hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {c.label}
            </button>
          );
        })}
      </nav>

      {/* Contenu par catégorie */}
      {category === "actualite" && <ActualiteView />}
      {category === "sondages" && <SondagesView />}
      {category === "votes" && <VotesView />}
      {category === "lois" && <LoisView />}
      {category === "agenda" && <AgendaView />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  ACTUALITÉ (veille RSS)
// ═══════════════════════════════════════════════════════════════════════════

const SOURCE_COLOR: Record<string, string> = {
  "Le Monde": "#b0212b",
  "Le Figaro": "#2c4978",
  "Libération": "#0a0a0c",
  "France Info": "#f0a020",
};

function ActualiteView() {
  const { data, isLoading, error } = useVeille();
  const [source, setSource] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const articles = data?.articles ?? [];
  const sources = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articles) m.set(a.source, (m.get(a.source) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [articles]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (source && a.source !== source) return false;
      if (q && !`${a.titre} ${a.resume}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [articles, source, query]);

  const selected = useMemo(
    () => (selectedId ? articles.find((a) => a.lien === selectedId) : items[0]) ?? null,
    [selectedId, articles, items],
  );
  const { pageItems, page, setPage, pageCount, total } = usePaged(items);

  return (
    <>
      <FilterSidebar>
        <SearchBox value={query} onChange={setQuery} placeholder="Filtrer un article…" />
        <FilterSection label="Sources">
          <FilterRow active={source === null} label="Tous les titres" count={articles.length} icon={Newspaper} onClick={() => setSource(null)} />
          {sources.map(([name, n]) => (
            <FilterRow key={name} active={source === name} label={name} count={n} dot onClick={() => setSource(source === name ? null : name)} />
          ))}
        </FilterSection>
      </FilterSidebar>

      <ListColumn eyebrow="Veille média · politique" title={`Articles · ${items.length}`}
        meta={data?.generated_at ? `maj ${relativeFr(data.generated_at)}` : undefined} loading={isLoading} error={!!error}
        pager={{ page, pageCount, total, onPage: setPage }}>
        {pageItems.map((a) => (
          <FeedItem key={a.lien} active={selected?.lien === a.lien} onClick={() => setSelectedId(a.lien)}
            icon={Newspaper} iconColor={SOURCE_COLOR[a.source] ?? "#8a8a93"}
            title={a.source} time={relativeFr(a.date)} subtitle={a.titre} />
        ))}
        {!isLoading && items.length === 0 && <EmptyRow />}
      </ListColumn>

      <DetailColumn k={selected?.lien}>
        {selected ? <ArticleDetail article={selected} /> : <DetailEmpty label="un article" />}
      </DetailColumn>
    </>
  );
}

function ArticleDetail({ article }: { article: Article }) {
  const color = SOURCE_COLOR[article.source] ?? "#8a8a93";
  return (
    <div className="flex flex-col gap-5 p-6 text-[13px]">
      <Breadcrumb parts={["Suivre", "Actualité", article.source]} />
      <div>
        <Pill color={color} icon={Newspaper}>{article.source}</Pill>
        <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">{article.titre}</h2>
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {article.date ? `${formatDateFr(article.date)} · ${relativeFr(article.date)}` : "—"}
        </p>
      </div>
      {article.resume && (
        <p className="text-[13px] leading-relaxed text-foreground/80">{article.resume}</p>
      )}
      <a href={article.lien} target="_blank" rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
        <ExternalLink className="h-3.5 w-3.5" /> Lire l&apos;article complet
      </a>
      <SourceNote>Flux RSS des rédactions — rubriques politique. Rafraîchi en continu.</SourceNote>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SONDAGES (notices CNCS)
// ═══════════════════════════════════════════════════════════════════════════

const SCRUTIN_META: Record<
  ScrutinCode,
  { label: string; icon: typeof Vote; color: string }
> = {
  presidentielle: { label: "Présidentielle 2027", icon: Flag, color: "#f0a020" },
  municipales: { label: "Municipales 2026", icon: Building2, color: "#2c4978" },
  legislatives: { label: "Législatives", icon: Landmark, color: "#b0212b" },
  europeennes: { label: "Européennes", icon: Vote, color: "#0d9488" },
  regionales: { label: "Régionales", icon: Vote, color: "#7c3aed" },
  departementales: { label: "Départementales", icon: Vote, color: "#0ea5e9" },
  senatoriales: { label: "Sénatoriales", icon: Landmark, color: "#525252" },
  referendum: { label: "Référendum", icon: Vote, color: "#16a34a" },
  autre: { label: "Autre / popularité", icon: BarChart3, color: "#8a8a93" },
};
const SCRUTIN_ORDER: ScrutinCode[] = [
  "presidentielle", "municipales", "legislatives", "europeennes",
  "regionales", "departementales", "senatoriales", "referendum", "autre",
];

// Texte explicatif adapté à la nature du sondage (tous ne portent pas sur des
// intentions de vote : baromètres de popularité, enquêtes thématiques…).
const NATURE_BLURB: Record<string, string> = {
  intentions:
    "Sondage d'intentions de vote. Les pourcentages par candidat / liste figurent dans la notice PDF officielle (parsing automatique à venir).",
  popularite:
    "Baromètre de popularité / cotes de personnalités — il ne s'agit pas d'intentions de vote. Les cotes détaillées figurent dans la notice PDF.",
  barometre:
    "Baromètre politique (climat, confiance, image). Les indicateurs détaillés figurent dans la notice PDF.",
  thematique:
    "Enquête d'opinion thématique (sujet de société ou d'actualité). Les résultats détaillés figurent dans la notice PDF.",
};

const NATURE_LABELS: Record<string, string> = {
  intentions: "Intentions de vote",
  popularite: "Cote de popularité",
  barometre: "Baromètre politique",
  thematique: "Enquête thématique",
};
const NATURE_ORDER = ["intentions", "popularite", "barometre", "thematique"];

function SondagesView() {
  const { data, isLoading, error } = useNotices();
  const [scrutin, setScrutin] = useState<"all" | ScrutinCode>("all");
  const [institut, setInstitut] = useState<string | null>(null);
  const [nature, setNature] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const notices = data?.notices ?? [];

  const scrutinsPresent = useMemo(() => {
    const counts = new Map<ScrutinCode, number>();
    for (const n of notices) counts.set(n.scrutin, (counts.get(n.scrutin) ?? 0) + 1);
    return SCRUTIN_ORDER.filter((s) => counts.has(s)).map((s) => ({ code: s, count: counts.get(s) ?? 0 }));
  }, [notices]);

  const naturesPresent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notices) counts.set(n.nature, (counts.get(n.nature) ?? 0) + 1);
    return NATURE_ORDER.filter((x) => counts.has(x)).map((x) => ({ code: x, count: counts.get(x) ?? 0 }));
  }, [notices]);

  const instituts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notices) if (n.institut) m.set(n.institut, (m.get(n.institut) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [notices]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notices
      .filter((n) => {
        if (scrutin !== "all" && n.scrutin !== scrutin) return false;
        if (institut && n.institut !== institut) return false;
        if (nature && n.nature !== nature) return false;
        if (q && !`${n.label} ${n.institut ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      })
      // Correctif : tri par date décroissante — les sondages récents en tête.
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [notices, scrutin, institut, nature, query]);

  const selected = useMemo(
    () => (selectedId ? notices.find((n) => n.pdf === selectedId) ?? null : null),
    [selectedId, notices],
  );
  const { pageItems, page, setPage, pageCount, total } = usePaged(items);

  const latestDate = items[0]?.date ?? null;

  return (
    <>
      <FilterSidebar>
        <SearchBox value={query} onChange={setQuery} placeholder="Filtrer (sujet, institut)…" />
        <FilterSection label="Scrutins">
          <FilterRow active={scrutin === "all"} label="Tous les sondages" count={notices.length} icon={FileText} onClick={() => { setScrutin("all"); setSelectedId(null); }} />
          {scrutinsPresent.map(({ code, count }) => {
            const meta = SCRUTIN_META[code];
            return <FilterRow key={code} active={scrutin === code} label={meta.label} count={count} icon={meta.icon} color={meta.color} onClick={() => { setScrutin(code); setSelectedId(null); }} />;
          })}
        </FilterSection>
        {naturesPresent.length > 1 && (
          <FilterSection label="Nature">
            <FilterRow active={nature === null} label="Toutes natures" icon={BarChart3} onClick={() => { setNature(null); setSelectedId(null); }} />
            {naturesPresent.map(({ code, count }) => (
              <FilterRow key={code} active={nature === code} label={NATURE_LABELS[code] ?? code} count={count} dot onClick={() => { setNature(nature === code ? null : code); setSelectedId(null); }} />
            ))}
          </FilterSection>
        )}
        {instituts.length > 0 && (
          <FilterSection label="Instituts">
            <FilterRow active={institut === null} label="Tous les instituts" icon={Building2} onClick={() => { setInstitut(null); setSelectedId(null); }} />
            {instituts.map(([name, n]) => (
              <FilterRow key={name} active={institut === name} label={name} count={n} dot onClick={() => { setInstitut(institut === name ? null : name); setSelectedId(null); }} />
            ))}
          </FilterSection>
        )}
      </FilterSidebar>

      <ListColumn
        eyebrow={`${data?.source ?? "Commission des sondages"}`}
        title={`${scrutin === "all" ? "Toutes les notices" : SCRUTIN_META[scrutin].label} · ${items.length}`}
        meta={latestDate ? `dernière : ${relativeFr(latestDate)}` : data?.generated_at ? `maj ${relativeFr(data.generated_at)}` : undefined}
        loading={isLoading}
        error={!!error}
        pager={{ page, pageCount, total, onPage: setPage }}
      >
        {pageItems.map((notice) => (
          <NoticeRow key={notice.pdf} notice={notice} active={selected?.pdf === notice.pdf} onClick={() => setSelectedId(notice.pdf)} />
        ))}
        {!isLoading && items.length === 0 && <EmptyRow />}
      </ListColumn>

      <DetailColumn k={selected?.pdf ?? "overview"}>
        {selected ? (
          <NoticeDetail notice={selected} />
        ) : (
          <SondagesOverview items={items} generatedAt={data?.generated_at ?? null} />
        )}
      </DetailColumn>
    </>
  );
}

/** Aperçu : cadence mensuelle, répartition par nature, dernière notice. */
function SondagesOverview({ items, generatedAt }: { items: Notice[]; generatedAt: string | null }) {
  const monthly = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of items) {
      if (!n.date) continue;
      const m = n.date.slice(0, 7); // YYYY-MM
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    // 10 derniers mois présents, ordre chronologique
    const months = [...counts.keys()].sort().slice(-10);
    const max = Math.max(1, ...months.map((m) => counts.get(m) ?? 0));
    return { months: months.map((m) => ({ m, n: counts.get(m) ?? 0 })), max };
  }, [items]);

  const byNature = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of items) counts.set(n.nature, (counts.get(n.nature) ?? 0) + 1);
    return NATURE_ORDER.filter((x) => counts.has(x)).map((x) => ({ code: x, n: counts.get(x) ?? 0 }));
  }, [items]);

  const latest = items[0] ?? null;

  return (
    <div className="flex flex-col gap-6 p-6 text-[13px]">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Aperçu</p>
        <p className="mt-1 text-[18px] font-semibold leading-tight">{items.length} notices</p>
        {latest?.date && (
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Dernière : {formatDateFr(latest.date)} · {relativeFr(latest.date)}
          </p>
        )}
      </div>

      {monthly.months.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Cadence mensuelle</p>
          <div className="mt-3 flex h-24 items-end gap-1.5">
            {monthly.months.map(({ m, n }) => (
              <div key={m} className="group flex flex-1 flex-col items-center gap-1">
                <span className="text-[9px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100">{n}</span>
                <div
                  className="w-full rounded-t bg-warm/70 transition-colors group-hover:bg-warm"
                  style={{ height: `${Math.max(4, (n / monthly.max) * 76)}px` }}
                />
                <span className="text-[8.5px] tabular-nums text-muted-foreground">{m.slice(5)}/{m.slice(2, 4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {byNature.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Par nature</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {byNature.map(({ code, n }) => {
              const w = items.length > 0 ? (n / items.length) * 100 : 0;
              return (
                <div key={code} className="flex items-center gap-2 text-[12px]">
                  <span className="w-36 shrink-0 truncate">{NATURE_LABELS[code] ?? code}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-soft/60">
                    <span className="block h-full rounded-pill bg-primary/70" style={{ width: `${w}%` }} />
                  </div>
                  <span className="w-7 shrink-0 text-right tabular-nums text-muted-foreground">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-auto text-[10.5px] text-muted-foreground/70">
        Source · Commission des sondages{generatedAt ? ` — généré ${relativeFr(generatedAt)}` : ""}. Sélectionne une notice pour le détail.
      </p>
    </div>
  );
}

function NoticeRow({ notice, active, onClick }: { notice: Notice; active: boolean; onClick: () => void }) {
  const meta = SCRUTIN_META[notice.scrutin];
  const Icon = meta.icon;
  return (
    <FeedItem active={active} onClick={onClick} iconColor={meta.color} icon={Icon}
      title={notice.institut ?? "Institut n.c."} time={relativeFr(notice.date)} subtitle={cleanLabel(notice)}
      badge={{ label: notice.nature_label, color: meta.color }} />
  );
}

function NoticeDetail({ notice }: { notice: Notice }) {
  const meta = SCRUTIN_META[notice.scrutin];
  const Icon = meta.icon;
  return (
    <div className="flex flex-col gap-5 p-6 text-[13px]">
      <Breadcrumb parts={["Suivre", "Sondages", meta.label]} />
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill color={meta.color} icon={Icon}>{meta.label}</Pill>
          <span className="rounded-pill bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {notice.nature_label}
          </span>
        </div>
        <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">{notice.institut ?? "Institut non communiqué"}</h2>
        <p className="mt-1.5 text-[13px] text-foreground/80">{cleanLabel(notice)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <KPI label="Date de dépôt" value={notice.date ? formatDateFr(notice.date) : "—"} hint={relativeFr(notice.date)} icon={Calendar} />
        <KPI label="N° notice" value={notice.numero ?? "—"} hint="Registre CNCS" />
        <KPI label="Institut" value={notice.institut ?? "n.c."} icon={Building2} />
        <KPI label="Média / commanditaire" value={notice.media ?? "n.c."} />
      </div>
      <div className="rounded-md border border-dashed border-border bg-surface-alt/50 p-4">
        <p className="text-[12px] font-medium">{notice.nature_label}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
          {NATURE_BLURB[notice.nature]}
        </p>
        <a href={notice.pdf} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
          <ExternalLink className="h-3.5 w-3.5" /> Ouvrir la notice PDF
        </a>
      </div>
      <SourceNote>Commission des sondages — registre public. Mise à jour quotidienne automatique.</SourceNote>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  VOTES AN
// ═══════════════════════════════════════════════════════════════════════════

function VotesView() {
  const { data, isLoading, error } = useVotesAN();
  const [sortFilter, setSortFilter] = useState<"all" | "adopte" | "rejete">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const votes = data?.votes ?? [];
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return votes.filter((v) => {
      const isAdopte = (v.sort ?? "").toLowerCase().includes("adopt");
      if (sortFilter === "adopte" && !isAdopte) return false;
      if (sortFilter === "rejete" && isAdopte) return false;
      if (q && !(v.titre ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [votes, sortFilter, query]);

  const selected = useMemo(
    () => (selectedId ? votes.find((v) => v.numero === selectedId) : items[0]) ?? null,
    [selectedId, votes, items],
  );
  const { pageItems, page, setPage, pageCount, total } = usePaged(items);

  return (
    <>
      <FilterSidebar>
        <SearchBox value={query} onChange={setQuery} placeholder="Filtrer un scrutin…" />
        <FilterSection label="Issue du vote">
          <FilterRow active={sortFilter === "all"} label="Tous" count={votes.length} icon={Vote} onClick={() => setSortFilter("all")} />
          <FilterRow active={sortFilter === "adopte"} label="Adoptés" icon={CheckCircle2} color="#2b7748" onClick={() => setSortFilter("adopte")} />
          <FilterRow active={sortFilter === "rejete"} label="Rejetés" icon={XCircle} color="#b0212b" onClick={() => setSortFilter("rejete")} />
        </FilterSection>
      </FilterSidebar>

      <ListColumn eyebrow="Assemblée nationale · 17e lég." title={`Scrutins publics · ${items.length}`}
        meta={data?.generated_at ? `maj ${relativeFr(data.generated_at)}` : undefined} loading={isLoading} error={!!error}
        pager={{ page, pageCount, total, onPage: setPage }}>
        {pageItems.map((v) => <VoteRow key={v.numero} vote={v} active={selected?.numero === v.numero} onClick={() => setSelectedId(v.numero)} />)}
        {!isLoading && items.length === 0 && <EmptyRow />}
      </ListColumn>

      <DetailColumn k={selected?.numero}>
        {selected ? <VoteDetail vote={selected} /> : <DetailEmpty label="un scrutin" />}
      </DetailColumn>
    </>
  );
}

function voteAdopted(v: VoteAN): boolean {
  return (v.sort ?? "").toLowerCase().includes("adopt");
}

function VoteRow({ vote, active, onClick }: { vote: VoteAN; active: boolean; onClick: () => void }) {
  const adopted = voteAdopted(vote);
  return (
    <FeedItem active={active} onClick={onClick}
      icon={adopted ? CheckCircle2 : XCircle} iconColor={adopted ? "#2b7748" : "#b0212b"}
      title={vote.sort_libelle ?? (adopted ? "Adopté" : "Rejeté")}
      time={relativeFr(vote.date)}
      subtitle={vote.titre ?? "—"}
      badge={{ label: `${vote.pour} pour · ${vote.contre} contre`, color: adopted ? "#2b7748" : "#b0212b" }} />
  );
}

function VoteDetail({ vote }: { vote: VoteAN }) {
  const adopted = voteAdopted(vote);
  const total = Math.max(vote.pour + vote.contre + vote.abstentions, 1);
  return (
    <div className="flex flex-col gap-5 p-6 text-[13px]">
      <Breadcrumb parts={["Suivre", "Votes AN", `Scrutin n°${vote.numero}`]} />
      <div>
        <Pill color={adopted ? "#2b7748" : "#b0212b"} icon={adopted ? CheckCircle2 : XCircle}>
          {vote.sort_libelle ?? (adopted ? "Adopté" : "Rejeté")}
        </Pill>
        <h2 className="mt-2 text-[20px] font-semibold leading-tight tracking-tight">{vote.titre}</h2>
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {formatDateFr(vote.date)} · {vote.type ?? "scrutin public"}
          {vote.demandeur ? ` · ${vote.demandeur}` : ""}
        </p>
      </div>

      {/* Barre pour/contre/abstention */}
      <div>
        <div className="flex h-3 overflow-hidden rounded-pill">
          <div style={{ width: `${(vote.pour / total) * 100}%`, background: "#2b7748" }} />
          <div style={{ width: `${(vote.contre / total) * 100}%`, background: "#b0212b" }} />
          <div style={{ width: `${(vote.abstentions / total) * 100}%`, background: "#c8c8cc" }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <KPI label="Pour" value={String(vote.pour)} icon={CheckCircle2} />
          <KPI label="Contre" value={String(vote.contre)} icon={XCircle} />
          <KPI label="Abstentions" value={String(vote.abstentions)} icon={MinusCircle} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <KPI label="Votants" value={String(vote.votants)} />
        <KPI label="Exprimés" value={String(vote.exprimes)} />
      </div>

      <SourceNote>Assemblée nationale — open data officiel (17e législature).</SourceNote>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  LOIS & PPL
// ═══════════════════════════════════════════════════════════════════════════

function LoisView() {
  const { data, isLoading, error } = useLois();
  const [typeFilter, setTypeFilter] = useState<"all" | "projet" | "proposition">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const lois = data?.lois ?? [];
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lois.filter((l) => {
      const t = (l.type ?? "").toLowerCase();
      if (typeFilter === "projet" && !t.includes("projet")) return false;
      if (typeFilter === "proposition" && !t.includes("proposition")) return false;
      if (q && !l.titre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lois, typeFilter, query]);

  const selected = useMemo(
    () => (selectedId ? lois.find((l) => l.uid === selectedId) : items[0]) ?? null,
    [selectedId, lois, items],
  );
  const { pageItems, page, setPage, pageCount, total } = usePaged(items);

  return (
    <>
      <FilterSidebar>
        <SearchBox value={query} onChange={setQuery} placeholder="Filtrer un texte…" />
        <FilterSection label="Type de texte">
          <FilterRow active={typeFilter === "all"} label="Tous" count={lois.length} icon={FileText} onClick={() => setTypeFilter("all")} />
          <FilterRow active={typeFilter === "projet"} label="Projets de loi (gouv.)" icon={Landmark} color="#2c4978" onClick={() => setTypeFilter("projet")} />
          <FilterRow active={typeFilter === "proposition"} label="Propositions (parl.)" icon={FileText} color="#f0a020" onClick={() => setTypeFilter("proposition")} />
        </FilterSection>
      </FilterSidebar>

      <ListColumn eyebrow="Assemblée nationale · 17e lég." title={`Dossiers législatifs · ${items.length}`}
        meta={data?.generated_at ? `maj ${relativeFr(data.generated_at)}` : undefined} loading={isLoading} error={!!error}
        pager={{ page, pageCount, total, onPage: setPage }}>
        {pageItems.map((l) => <LoiRow key={l.uid} loi={l} active={selected?.uid === l.uid} onClick={() => setSelectedId(l.uid)} />)}
        {!isLoading && items.length === 0 && <EmptyRow />}
      </ListColumn>

      <DetailColumn k={selected?.uid}>
        {selected ? <LoiDetail loi={selected} /> : <DetailEmpty label="un texte" />}
      </DetailColumn>
    </>
  );
}

function isProjet(l: Loi): boolean {
  return (l.type ?? "").toLowerCase().includes("projet");
}

function LoiRow({ loi, active, onClick }: { loi: Loi; active: boolean; onClick: () => void }) {
  const projet = isProjet(loi);
  return (
    <FeedItem active={active} onClick={onClick}
      icon={projet ? Landmark : FileText} iconColor={projet ? "#2c4978" : "#f0a020"}
      title={projet ? "Projet de loi" : "Proposition de loi"}
      time={relativeFr(loi.date)} subtitle={loi.titre}
      badge={loi.stade ? { label: loi.stade, color: projet ? "#2c4978" : "#f0a020" } : undefined} />
  );
}

function LoiDetail({ loi }: { loi: Loi }) {
  const projet = isProjet(loi);
  return (
    <div className="flex flex-col gap-5 p-6 text-[13px]">
      <Breadcrumb parts={["Suivre", "Lois & PPL", projet ? "Projet de loi" : "Proposition de loi"]} />
      <div>
        <Pill color={projet ? "#2c4978" : "#f0a020"} icon={projet ? Landmark : FileText}>
          {loi.type ?? (projet ? "Projet de loi" : "Proposition de loi")}
        </Pill>
        <h2 className="mt-2 text-[20px] font-semibold leading-tight tracking-tight">{loi.titre}</h2>
        {loi.stade && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-foreground/80">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: projet ? "#2c4978" : "#f0a020" }} />
            Stade actuel : {loi.stade}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <KPI label="Déposé le" value={loi.date_depot ? formatDateFr(loi.date_depot) : "—"} icon={Calendar} />
        <KPI label="Dernière activité" value={loi.date ? formatDateFr(loi.date) : "—"} hint={relativeFr(loi.date)} />
        <KPI label="Type" value={projet ? "Projet (gouv.)" : "Proposition (parl.)"} />
        <KPI label="Étapes législatives" value={String(loi.n_actes)} hint="actes enregistrés" />
      </div>
      {loi.timeline && loi.timeline.length > 0 && (
        <LoiTimeline steps={loi.timeline} />
      )}

      {loi.url && (
        <a href={loi.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
          <ExternalLink className="h-3.5 w-3.5" /> Suivre le dossier sur l&apos;Assemblée
        </a>
      )}
      <SourceNote>Assemblée nationale — dossiers législatifs (17e législature).</SourceNote>
    </div>
  );
}

const PHASE_META: Record<string, { color: string; label: string }> = {
  depot: { color: "#8a8a93", label: "Dépôt" },
  commission: { color: "#2c4978", label: "Commission" },
  seance: { color: "#f0a020", label: "Séance" },
  decision: { color: "#7c3aed", label: "Décision" },
  cmp: { color: "#0ea5e9", label: "CMP" },
  conseil: { color: "#525252", label: "Conseil const." },
  promulgation: { color: "#16a34a", label: "Promulgation" },
  autre: { color: "#c8c8cc", label: "Étape" },
};

function LoiTimeline({ steps }: { steps: LoiStep[] }) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Parcours législatif · {steps.length} étapes
      </p>
      <ol className="flex flex-col">
        {steps.map((s, i) => {
          const meta = PHASE_META[s.phase] ?? PHASE_META.autre;
          const last = i === steps.length - 1;
          const range =
            s.count > 1 && s.date_fin !== s.date
              ? `${formatDateFr(s.date)} → ${formatDateFr(s.date_fin)}`
              : formatDateFr(s.date);
          return (
            <li key={i} className="flex gap-3">
              {/* Rail */}
              <div className="flex flex-col items-center">
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface"
                  style={{ background: meta.color }}
                />
                {!last && (
                  <span className="w-px flex-1 bg-border" style={{ minHeight: 18 }} />
                )}
              </div>
              {/* Contenu */}
              <div className={cn("pb-3", last && "pb-0")}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-medium leading-tight">
                    {s.libelle}
                  </span>
                  {s.count > 1 && (
                    <span className="rounded-pill bg-surface-soft px-1.5 text-[10px] font-medium text-muted-foreground">
                      ×{s.count}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {s.chambre ? `${s.chambre} · ` : ""}
                  {range}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  AGENDA
// ═══════════════════════════════════════════════════════════════════════════

const AGENDA_TYPE_COLOR: Record<string, string> = {
  scrutin: "#f0a020",
  echeance: "#2c4978",
  campagne: "#16a34a",
};

function AgendaView() {
  const { data, isLoading, error } = useAgenda();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const events = data?.evenements ?? [];
  const selected = useMemo(
    () => (selectedId ? events.find((e) => e.date + e.titre === selectedId) : events.find((e) => !e.passe) ?? events[0]) ?? null,
    [selectedId, events],
  );

  return (
    <>
      <FilterSidebar>
        <FilterSection label="Légende">
          <LegendRow color={AGENDA_TYPE_COLOR.scrutin} label="Scrutin" />
          <LegendRow color={AGENDA_TYPE_COLOR.echeance} label="Échéance" />
          <LegendRow color={AGENDA_TYPE_COLOR.campagne} label="Campagne" />
        </FilterSection>
      </FilterSidebar>

      <ListColumn eyebrow="Calendrier électoral" title={`Échéances · ${events.length}`}
        meta={data?.generated_at ? `maj ${relativeFr(data.generated_at)}` : undefined} loading={isLoading} error={!!error}>
        {events.map((e) => (
          <AgendaRow key={e.date + e.titre} event={e} active={selected?.date + (selected?.titre ?? "") === e.date + e.titre} onClick={() => setSelectedId(e.date + e.titre)} />
        ))}
        {!isLoading && events.length === 0 && <EmptyRow />}
      </ListColumn>

      <DetailColumn k={selected ? selected.date + selected.titre : undefined}>
        {selected ? <AgendaDetail event={selected} /> : <DetailEmpty label="une échéance" />}
      </DetailColumn>
    </>
  );
}

function AgendaRow({ event, active, onClick }: { event: AgendaEvent; active: boolean; onClick: () => void }) {
  const color = AGENDA_TYPE_COLOR[event.type] ?? "#8a8a93";
  return (
    <FeedItem active={active} onClick={onClick} icon={CalendarDays} iconColor={color}
      title={event.titre} time={event.passe ? "passé" : relativeFr(event.date)}
      subtitle={formatDateFr(event.date)} dim={event.passe}
      badge={{ label: event.type, color }} />
  );
}

function AgendaDetail({ event }: { event: AgendaEvent }) {
  const color = AGENDA_TYPE_COLOR[event.type] ?? "#8a8a93";
  return (
    <div className="flex flex-col gap-5 p-6 text-[13px]">
      <Breadcrumb parts={["Suivre", "Agenda", event.titre]} />
      <div>
        <Pill color={color} icon={CalendarDays}>{event.type}</Pill>
        <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">{event.titre}</h2>
        <p className="mt-1.5 text-[13px] text-foreground/80">{formatDateFr(event.date)}{event.passe ? " · passé" : ` · ${relativeFr(event.date)}`}</p>
      </div>
      {event.detail && <p className="text-[13px] leading-relaxed text-foreground/80">{event.detail}</p>}
      <SourceNote>Calendrier curé (Code électoral / décrets de convocation). Enrichissement JORF à venir.</SourceNote>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Primitives partagées
// ═══════════════════════════════════════════════════════════════════════════

function FilterSidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-5 overflow-y-auto rounded-lg bg-surface p-4 text-[13px] shadow-card">
      {children}
    </aside>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-border/80 bg-surface px-2 text-[12px] focus-within:border-foreground/30">
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70" />
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <div className="-mx-1 mt-3 flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

function FilterRow({
  active, label, count, icon: Icon, color, dot, onClick,
}: {
  active: boolean; label: string; count?: number; icon?: typeof Vote; color?: string; dot?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
        active ? "bg-surface-soft text-foreground" : "text-foreground/70 hover:bg-surface-soft hover:text-foreground",
      )}>
      {Icon ? <Icon className="h-3.5 w-3.5" style={color ? { color } : undefined} /> : null}
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-border" /> : null}
      <span className="flex-1 truncate font-medium">{label}</span>
      {count !== undefined && <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>}
    </button>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5 text-[13px] text-foreground/70">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </div>
  );
}

function ListColumn({
  eyebrow, title, meta, loading, error, children, pager,
}: {
  eyebrow: string; title: string; meta?: string; loading?: boolean; error?: boolean;
  children: React.ReactNode;
  pager?: { page: number; pageCount: number; total: number; onPage: (p: number) => void };
}) {
  return (
    <section className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-lg bg-surface shadow-card">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-4">
        <div className="flex flex-col leading-tight">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p>
          <p className="text-[13px] font-medium">{title}</p>
        </div>
        {meta && <span className="ml-auto text-[10.5px] text-muted-foreground">{meta}</span>}
      </header>
      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-destructive">
          Erreur de chargement.
        </div>
      ) : (
        <ul key={pager?.page} className="anim-stagger flex-1 divide-y divide-border/40 overflow-y-auto">
          {children}
        </ul>
      )}
      {pager && pager.total > 0 && <Pager {...pager} />}
    </section>
  );
}

function Pager({
  page, pageCount, total, onPage,
}: {
  page: number; pageCount: number; total: number; onPage: (p: number) => void;
}) {
  const from = page * PER_PAGE + 1;
  const to = Math.min((page + 1) * PER_PAGE, total);
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-border/60 px-3 text-[11.5px]">
      <span className="text-muted-foreground tabular-nums">
        {from}–{to} sur {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 0}
          className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-foreground/70 transition-colors hover:bg-surface-soft disabled:opacity-40 disabled:hover:bg-surface"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="px-1 tabular-nums text-muted-foreground">
          {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
          className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-foreground/70 transition-colors hover:bg-surface-soft disabled:opacity-40 disabled:hover:bg-surface"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DetailColumn({ k, children }: { k?: string | null; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-surface shadow-card">
      <div key={k ?? "empty"} className="anim-fade-in min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </section>
  );
}

function FeedItem({
  active, onClick, icon: Icon, iconColor, title, time, subtitle, dim, badge,
}: {
  active: boolean; onClick: () => void; icon: typeof Vote; iconColor: string;
  title: string; time: string; subtitle: string; dim?: boolean;
  badge?: { label: string; color?: string };
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        data-active={active ? "" : undefined}
        className={cn(
          "relative flex w-full items-start gap-3 py-3 pl-4 pr-4 text-left transition-colors",
          active ? "bg-surface-soft/70" : "hover:bg-surface-soft/40",
        )}
      >
        {/* Accent latéral quand actif */}
        {active && (
          <span className="absolute inset-y-0 left-0 w-[3px] rounded-r" style={{ background: iconColor }} />
        )}
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ background: `${iconColor}1a`, color: iconColor }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className={cn("min-w-0 flex-1", dim && "opacity-60")}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-medium">{title}</p>
            <span className="shrink-0 text-[10.5px] text-muted-foreground tabular-nums">{time}</span>
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{subtitle}</p>
          {badge && (
            <span
              className="mt-1.5 inline-flex items-center rounded-pill px-1.5 py-0.5 text-[9.5px] font-medium"
              style={{
                background: badge.color ? `${badge.color}1a` : "var(--surface-soft)",
                color: badge.color ?? "var(--muted-foreground)",
              }}
            >
              {badge.label}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function EmptyRow() {
  return <li className="px-4 py-8 text-center text-[12px] text-muted-foreground">Aucun élément.</li>;
}

function DetailEmpty({ label }: { label: string }) {
  return <div className="grid h-full place-items-center text-[12px] text-muted-foreground">Sélectionne {label} pour ouvrir le détail.</div>;
}

function Breadcrumb({ parts }: { parts: string[] }) {
  return (
    <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1.5 text-muted-foreground/50">/</span>}
          {p}
        </span>
      ))}
    </p>
  );
}

function Pill({ color, icon: Icon, children }: { color: string; icon: typeof Vote; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-medium" style={{ background: `${color}1a`, color }}>
      <Icon className="h-3 w-3" /> {children}
    </span>
  );
}

function KPI({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon?: typeof Calendar }) {
  return (
    <div className="rounded-md border border-border/70 bg-surface-alt p-3">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}{label}
      </p>
      <p className="mt-1 truncate text-[16px] font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-auto pt-2 text-[10.5px] text-muted-foreground/70">Source : {children}</p>;
}
