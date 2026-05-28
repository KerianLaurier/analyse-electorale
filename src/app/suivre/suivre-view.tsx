"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Landmark,
  Building2,
  Vote,
  Flag,
  Search,
  Loader2,
  ExternalLink,
  FileText,
  Calendar,
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

// ─── Métadonnées scrutins ──────────────────────────────────────────────────

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

// Ordre d'affichage des scrutins dans la sidebar.
const SCRUTIN_ORDER: ScrutinCode[] = [
  "presidentielle",
  "municipales",
  "legislatives",
  "europeennes",
  "regionales",
  "departementales",
  "senatoriales",
  "referendum",
  "autre",
];

type ScrutinFilter = "all" | ScrutinCode;

export function SuivreView() {
  const { data, isLoading, error } = useNotices();
  const [scrutin, setScrutin] = useState<ScrutinFilter>("all");
  const [institut, setInstitut] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const notices = data?.notices ?? [];

  const scrutinsPresent = useMemo(() => {
    const counts = new Map<ScrutinCode, number>();
    for (const n of notices) counts.set(n.scrutin, (counts.get(n.scrutin) ?? 0) + 1);
    return SCRUTIN_ORDER.filter((s) => counts.has(s)).map((s) => ({
      code: s,
      count: counts.get(s) ?? 0,
    }));
  }, [notices]);

  const instituts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notices) {
      if (n.institut) m.set(n.institut, (m.get(n.institut) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [notices]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notices.filter((n) => {
      if (scrutin !== "all" && n.scrutin !== scrutin) return false;
      if (institut && n.institut !== institut) return false;
      if (q) {
        const hay = `${n.label} ${n.institut ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notices, scrutin, institut, query]);

  const selected = useMemo(() => {
    if (selectedId) return notices.find((n) => n.pdf === selectedId) ?? null;
    return items[0] ?? null;
  }, [selectedId, notices, items]);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 gap-3 overflow-hidden bg-canvas p-3">
      {/* ── Sidebar ── */}
      <aside className="flex w-[268px] shrink-0 flex-col gap-5 overflow-y-auto rounded-lg bg-surface p-4 text-[13px] shadow-card">
        <div className="flex h-8 items-center gap-2 rounded-md border border-border/80 bg-surface px-2 text-[12px] focus-within:border-foreground/30">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer (sujet, institut)…"
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70"
          />
        </div>

        <section>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Scrutins
          </p>
          <div className="-mx-1 mt-3 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setScrutin("all")}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                scrutin === "all"
                  ? "bg-surface-soft text-foreground"
                  : "text-foreground/70 hover:bg-surface-soft hover:text-foreground",
              )}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 font-medium">Tous les sondages</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {notices.length}
              </span>
            </button>
            {scrutinsPresent.map(({ code, count }) => {
              const meta = SCRUTIN_META[code];
              const Icon = meta.icon;
              const active = scrutin === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setScrutin(code)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                    active
                      ? "bg-surface-soft text-foreground"
                      : "text-foreground/70 hover:bg-surface-soft hover:text-foreground",
                  )}
                >
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: meta.color }}
                  />
                  <span className="flex-1 font-medium">{meta.label}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {instituts.length > 0 && (
          <section>
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Instituts
            </p>
            <div className="-mx-1 mt-3 flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setInstitut(null)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                  institut === null
                    ? "bg-surface-soft text-foreground"
                    : "text-foreground/70 hover:bg-surface-soft hover:text-foreground",
                )}
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 font-medium">Tous les instituts</span>
              </button>
              {instituts.map(([name, n]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setInstitut(institut === name ? null : name)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                    institut === name
                      ? "bg-surface-soft text-foreground"
                      : "text-foreground/70 hover:bg-surface-soft hover:text-foreground",
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="flex-1 truncate font-medium">{name}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {n}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </aside>

      {/* ── Liste ── */}
      <section className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-lg bg-surface shadow-card">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-4">
          <div className="flex flex-col leading-tight">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Commission des sondages
            </p>
            <p className="text-[13px] font-medium">
              {scrutin === "all"
                ? "Toutes les notices"
                : SCRUTIN_META[scrutin].label}{" "}
              · {items.length}
            </p>
          </div>
          {data?.generated_at && (
            <span className="ml-auto text-[10.5px] text-muted-foreground">
              maj {relativeFr(data.generated_at)}
            </span>
          )}
        </header>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des notices…
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-destructive">
            Erreur de chargement des notices CNCS.
          </div>
        ) : (
          <ul className="anim-stagger flex-1 divide-y divide-border/40 overflow-y-auto">
            {items.map((notice) => (
              <NoticeRow
                key={notice.pdf}
                notice={notice}
                active={selected?.pdf === notice.pdf}
                onClick={() => setSelectedId(notice.pdf)}
              />
            ))}
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                Aucune notice.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* ── Détail ── */}
      <section
        key={selected?.pdf ?? "empty"}
        className="anim-fade-in flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-surface shadow-card"
      >
        {selected ? (
          <NoticeDetail notice={selected} />
        ) : (
          <div className="grid h-full place-items-center text-[12px] text-muted-foreground">
            Sélectionne une notice pour ouvrir le détail.
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Ligne de notice ───────────────────────────────────────────────────────

function NoticeRow({
  notice,
  active,
  onClick,
}: {
  notice: Notice;
  active: boolean;
  onClick: () => void;
}) {
  const meta = SCRUTIN_META[notice.scrutin];
  const Icon = meta.icon;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
          active ? "bg-surface-soft/70" : "hover:bg-surface-soft/40",
        )}
      >
        <span
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md"
          style={{ background: `${meta.color}1a`, color: meta.color }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-medium">
              {notice.institut ?? "Institut n.c."}
            </p>
            <span className="shrink-0 text-[10.5px] text-muted-foreground tabular-nums">
              {relativeFr(notice.date)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {cleanLabel(notice)}
          </p>
        </div>
      </button>
    </li>
  );
}

// ─── Détail de notice ──────────────────────────────────────────────────────

function NoticeDetail({ notice }: { notice: Notice }) {
  const meta = SCRUTIN_META[notice.scrutin];
  const Icon = meta.icon;
  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-6 text-[13px]">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Suivre <span className="mx-1.5 text-muted-foreground/50">/</span> Sondages{" "}
        <span className="mx-1.5 text-muted-foreground/50">/</span>{" "}
        {meta.label}
      </p>

      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-medium"
          style={{ background: `${meta.color}1a`, color: meta.color }}
        >
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
        <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">
          {notice.institut ?? "Institut non communiqué"}
        </h2>
        <p className="mt-1.5 text-[13px] text-foreground/80">{cleanLabel(notice)}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <DetailKPI
          label="Date de dépôt"
          value={notice.date ? formatDateFr(notice.date) : "—"}
          hint={relativeFr(notice.date)}
          icon={Calendar}
        />
        <DetailKPI
          label="N° notice"
          value={notice.numero ?? "—"}
          hint="Registre CNCS"
        />
        <DetailKPI
          label="Institut"
          value={notice.institut ?? "n.c."}
          hint={null}
        />
      </div>

      <div className="rounded-md border border-dashed border-border bg-surface-alt/50 p-4">
        <p className="text-[12px] font-medium">Intentions de vote</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
          Les chiffres détaillés figurent dans la notice PDF officielle. Le
          parsing automatique des résultats (par institut) sera ajouté
          progressivement.
        </p>
        <a
          href={notice.pdf}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ouvrir la notice PDF
        </a>
      </div>

      <p className="text-[10.5px] text-muted-foreground/70">
        Source : Commission des sondages — registre public des notices. Mise à
        jour quotidienne automatique.
      </p>
    </div>
  );
}

function DetailKPI({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string | null;
  icon?: typeof Calendar;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-surface-alt p-3">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className="mt-1 truncate text-[15px] font-semibold">{value}</p>
      {hint && (
        <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground/80">
          {hint}
        </p>
      )}
    </div>
  );
}
