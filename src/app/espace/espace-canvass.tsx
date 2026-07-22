"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DoorOpen, Plus, Users, Trash2, MapPin, Loader2, Info, ClipboardList, Target, TrendingUp, LayoutGrid, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReports, useLoadState as useCanvassLoad, addReport, deleteReport, summarize, bySector, weeklyTrend, type CanvassReport, type SectorAgg, type WeekPoint } from "@/lib/canvass";
import { useSectors, useHasTeam, useCampaign, useLoadState as useCampaignLoad, voteGoal, updateSector, type Sector } from "@/lib/campaign";
import { CanvassMap } from "@/app/espace/canvass-map";
import { PanelsSkeleton } from "@/components/skeleton";
import { ErrorState } from "@/components/error-state";

export const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
export const fmtPct = (n: number, d = 0) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export const field = "rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20";

export function EspaceCanvass() {
  const canvassLoad = useCanvassLoad();
  const campaignLoad = useCampaignLoad();
  const hasTeam = useHasTeam();
  if (canvassLoad.error || campaignLoad.error)
    return <ErrorState message="Impossible de charger le porte-à-porte." onRetry={() => { canvassLoad.retry(); campaignLoad.retry(); }} />;
  if (!canvassLoad.loaded || !campaignLoad.loaded) return <PanelsSkeleton />;
  if (!hasTeam) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-pill bg-warm/15 text-warm">
          <DoorOpen className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold tracking-tight">Le porte-à-porte se pilote en équipe</p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Créez ou rejoignez une équipe pour bâtir un plan d’action, saisir les comptes-rendus de
          porte-à-porte et suivre le sondage terrain.
        </p>
        <Link href="/auth/team" className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
          <Users className="h-4 w-4" /> Gérer mon équipe
        </Link>
      </div>
    );
  }
  return <CanvassContent />;
}

function CanvassContent() {
  const reports = useReports().filter((r) => r.channel === "porte");
  const sectors = useSectors();
  const campaign = useCampaign();
  const summary = useMemo(() => summarize(reports), [reports]);
  const agg = useMemo(() => bySector(reports), [reports]);
  const trend = useMemo(() => weeklyTrend(reports), [reports]);
  const [showForm, setShowForm] = useState(false);
  const [presetSector, setPresetSector] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [planFilter, setPlanFilter] = useState<"all" | "todo" | "doing" | "done">("all");
  const [planQuery, setPlanQuery] = useState("");
  const [planExpanded, setPlanExpanded] = useState(false);

  const sortedSectors = useMemo(
    () => [...sectors].sort((a, b) => (b.priority ?? -1) - (a.priority ?? -1)),
    [sectors],
  );
  const coveredSectors = sectors.filter((s) => s.status === "done").length;
  const workedSectors = agg.size; // secteurs avec ≥ 1 compte-rendu
  const goal = voteGoal(campaign);

  // Plan d'action : filtrage, recherche, limite (lisibilité sur les gros plans).
  const PLAN_LIMIT = 12;
  const statusCounts = {
    todo: sectors.filter((s) => s.status === "todo").length,
    doing: sectors.filter((s) => s.status === "doing").length,
    done: coveredSectors,
  };
  const planQ = planQuery.trim().toLowerCase();
  const filteredPlan = useMemo(
    () =>
      sortedSectors.filter((s) => {
        if (planFilter !== "all" && s.status !== planFilter) return false;
        if (planQ && !`${s.name} ${s.address ?? ""}`.toLowerCase().includes(planQ)) return false;
        return true;
      }),
    [sortedSectors, planFilter, planQ],
  );
  const visiblePlan = planExpanded ? filteredPlan : filteredPlan.slice(0, PLAN_LIMIT);

  // Secteurs travaillés (avec CR), du plus visité au moins visité.
  const sectorSentiment = useMemo(() => {
    return [...agg.entries()]
      .map(([id, a]) => ({ sector: sectors.find((s) => s.id === id), agg: a }))
      .filter((x) => x.sector)
      .sort((a, b) => b.agg.met - a.agg.met) as { sector: Sector; agg: SectorAgg }[];
  }, [agg, sectors]);

  function openForm(sectorId: string | null) {
    setPresetSector(sectorId);
    setShowForm(true);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Sondage terrain ──────────────────────────────────────────── */}
      <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Sondage terrain
        </h2>
        {summary.opinions === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Saisissez vos premiers comptes-rendus pour faire émerger le sentiment de terrain.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[14px]">
              <span className="text-[26px] font-semibold tracking-tight text-emerald-600">{fmtPct(summary.favPct)}</span>{" "}
              de favorables sur <span className="font-semibold">{fmtInt(summary.opinions)}</span> personnes rencontrées
              <span className="text-muted-foreground"> ({summary.sessions} sortie{summary.sessions > 1 ? "s" : ""})</span>.
            </p>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-pill">
              <span className="bg-emerald-500" style={{ width: `${summary.favPct * 100}%` }} title={`Favorables ${fmtPct(summary.favPct)}`} />
              <span className="bg-slate-400" style={{ width: `${summary.neuPct * 100}%` }} title={`Neutres ${fmtPct(summary.neuPct)}`} />
              <span className="bg-red-500" style={{ width: `${summary.unfPct * 100}%` }} title={`Défavorables ${fmtPct(summary.unfPct)}`} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              <Legend color="bg-emerald-500" label="Favorables" value={`${fmtInt(summary.favorable)} · ${fmtPct(summary.favPct)}`} />
              <Legend color="bg-slate-400" label="Neutres" value={`${fmtInt(summary.neutral)} · ${fmtPct(summary.neuPct)}`} />
              <Legend color="bg-red-500" label="Défavorables" value={`${fmtInt(summary.unfavorable)} · ${fmtPct(summary.unfPct)}`} />
            </div>
            <p className="mt-2 inline-flex items-start gap-1.5 text-[10.5px] text-muted-foreground/80">
              <Info className="mt-0.5 h-3 w-3 shrink-0" /> Donnée déclarative issue du porte-à-porte — indicative, non représentative d’un sondage scientifique.
            </p>
          </>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Sorties" value={fmtInt(summary.sessions)} />
          <KPI label="Portes frappées" value={fmtInt(summary.doors)} />
          <KPI label="Rencontrées" value={fmtInt(summary.met)} />
          <KPI label="Taux de contact" value={summary.doors ? fmtPct(summary.contactRate) : "—"} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Progress
            label="Terrain couvert"
            value={sectors.length ? workedSectors / sectors.length : 0}
            detail={`${fmtInt(workedSectors)} / ${fmtInt(sectors.length)} secteurs`}
          />
          {goal != null && goal > 0 ? (
            <Progress
              label="Voix favorables identifiées"
              value={Math.min(1, summary.favorable / goal)}
              detail={`${fmtInt(summary.favorable)} / ${fmtInt(goal)} voix cible`}
              accent
            />
          ) : (
            <Progress label="Voix favorables identifiées" value={0} detail="Définissez un objectif dans l’onglet Campagne" muted />
          )}
        </div>
      </section>

      {/* ── Évolution hebdomadaire ────────────────────────────────────── */}
      {trend.length > 0 && (
        <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Évolution du sentiment · par semaine
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {trend.map((w) => (
              <WeekRow key={w.week} w={w} />
            ))}
          </div>
        </section>
      )}

      {/* ── Plan d'action ────────────────────────────────────────────── */}
      <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Plan d’action
          </h2>
          <span className="text-[11.5px] text-muted-foreground">{sortedSectors.length} secteurs · {coveredSectors} couverts</span>
        </div>
        {sortedSectors.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            Aucun secteur. Construisez votre plan de terrain dans l’onglet <span className="font-medium">Campagne</span> ou
            poussez les bureaux prioritaires depuis le <Link href="/analyser/ciblage" className="font-medium text-warm hover:underline">ciblage</Link>.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Chip active={planFilter === "all"} onClick={() => { setPlanFilter("all"); setPlanExpanded(false); }}>Tous · {sortedSectors.length}</Chip>
              <Chip active={planFilter === "todo"} onClick={() => { setPlanFilter("todo"); setPlanExpanded(false); }}>À couvrir · {statusCounts.todo}</Chip>
              <Chip active={planFilter === "doing"} onClick={() => { setPlanFilter("doing"); setPlanExpanded(false); }}>En cours · {statusCounts.doing}</Chip>
              <Chip active={planFilter === "done"} onClick={() => { setPlanFilter("done"); setPlanExpanded(false); }}>Couvert · {statusCounts.done}</Chip>
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={planQuery}
                  onChange={(e) => { setPlanQuery(e.target.value); setPlanExpanded(false); }}
                  placeholder="Rechercher un bureau…"
                  className="w-52 rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-[12.5px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20"
                />
              </div>
            </div>

            {filteredPlan.length === 0 ? (
              <p className="mt-3 px-1 py-6 text-center text-[12.5px] text-muted-foreground">Aucun secteur pour ce filtre.</p>
            ) : (
              <>
                <div className="mt-2 flex flex-col divide-y divide-border/50">
                  {visiblePlan.map((s) => (
                    <PlanRow key={s.id} sector={s} stat={agg.get(s.id)} onLog={() => openForm(s.id)} />
                  ))}
                </div>
                {filteredPlan.length > PLAN_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setPlanExpanded((v) => !v)}
                    className="mt-2 text-[12px] font-medium text-warm hover:underline"
                  >
                    {planExpanded ? "Réduire la liste" : `Afficher les ${filteredPlan.length - PLAN_LIMIT} autres secteurs`}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </section>

      {/* ── Carte de couverture ──────────────────────────────────────── */}
      {campaign?.target && sectors.some((s) => s.bureauCode) && (
        <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Carte de couverture
            </h2>
            <button type="button" onClick={() => setShowMap((v) => !v)} className="text-[11.5px] font-medium text-warm hover:underline">
              {showMap ? "Masquer la carte" : "Afficher la carte"}
            </button>
          </div>
          {showMap ? (
            <div className="mt-3">
              <CanvassMap target={campaign.target} sectors={sectors} agg={agg} />
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted-foreground">Visualisez l’avancement du porte-à-porte bureau par bureau sur la carte.</p>
          )}
        </section>
      )}

      {/* ── Sentiment par secteur ────────────────────────────────────── */}
      {sectorSentiment.length > 0 && (
        <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5" /> Sentiment par secteur
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Comparer les zones travaillées : où le terrain est le plus favorable.</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {sectorSentiment.map(({ sector, agg: a }) => (
              <SectorSentimentRow key={sector.id} name={sector.name} agg={a} />
            ))}
          </div>
        </section>
      )}

      {/* ── Comptes-rendus ───────────────────────────────────────────── */}
      <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" /> Comptes-rendus · {reports.length}
          </h2>
          <button type="button" onClick={() => openForm(null)} className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Nouveau compte-rendu
          </button>
        </div>

        {showForm && (
          <ReportForm sectors={sortedSectors} presetSector={presetSector} onDone={() => setShowForm(false)} />
        )}

        {reports.length === 0 && !showForm ? (
          <p className="mt-3 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            Aucun compte-rendu. Après chaque sortie de porte-à-porte, saisissez les chiffres pour
            alimenter le sondage terrain.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} sectorName={sectors.find((s) => s.id === r.sectorId)?.name ?? null} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_DOT: Record<string, string> = { todo: "bg-slate-300", doing: "bg-amber-500", done: "bg-emerald-500" };

function PlanRow({ sector, stat, onLog }: { sector: Sector; stat?: { sessions: number; met: number; favorable: number }; onLog: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[sector.status] ?? "bg-slate-300")} title={sector.status} />
      <p className="flex min-w-[150px] shrink-0 items-center gap-1.5 text-[12.5px] font-medium">
        {sector.name}
        {sector.priority != null && (
          <span className={cn("rounded-pill px-1.5 py-0.5 text-[10px] font-semibold", sector.priority >= 66 ? "bg-red-100 text-red-700" : sector.priority >= 40 ? "bg-amber-100 text-amber-700" : "bg-surface-soft text-muted-foreground")}>
            P{sector.priority}
          </span>
        )}
      </p>
      <input
        key={`addr-${sector.id}-${sector.address ?? ""}`}
        defaultValue={sector.address ?? ""}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== (sector.address ?? "")) updateSector(sector.id, { address: v || null });
        }}
        placeholder="Adresse / rues…"
        className="min-w-[120px] flex-1 rounded border border-transparent bg-canvas/40 px-2 py-1 text-[11.5px] outline-none focus:border-warm focus:bg-surface"
      />
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {stat ? (
          <><span className="font-medium text-foreground">{fmtInt(stat.met)}</span> renc. · {fmtInt(stat.favorable)} fav.</>
        ) : (
          "—"
        )}
      </span>
      <button type="button" onClick={onLog} title="Saisir un compte-rendu" className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-foreground/[0.04] px-2.5 py-1.5 text-[11.5px] font-medium text-foreground hover:bg-foreground/[0.08]">
        <Plus className="h-3.5 w-3.5" /> CR
      </button>
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.04] text-foreground/80 hover:bg-foreground/[0.08]",
      )}
    >
      {children}
    </button>
  );
}

function ReportForm({ sectors, presetSector, onDone }: { sectors: Sector[]; presetSector: string | null; onDone: () => void }) {
  const hasTeam = useHasTeam();
  const [sectorId, setSectorId] = useState<string>(presetSector ?? "");
  const [zone, setZone] = useState("");
  const [date, setDate] = useState(todayISO());
  const [volunteers, setVolunteers] = useState("1");
  const [doors, setDoors] = useState("");
  const [favorable, setFavorable] = useState("");
  const [neutral, setNeutral] = useState("");
  const [unfavorable, setUnfavorable] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const num = (s: string) => Math.max(0, Math.round(Number(s) || 0));
  const met = num(favorable) + num(neutral) + num(unfavorable);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    await addReport({
      sectorId: sectorId || null,
      zone: zone.trim() || null,
      date,
      volunteers: num(volunteers) || 1,
      doors: num(doors),
      met,
      favorable: num(favorable),
      neutral: num(neutral),
      unfavorable: num(unfavorable),
      notes: notes.trim() || null,
      shared: hasTeam,
    });
    setBusy(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Secteur</span>
          <select value={sectorId} onChange={(e) => setSectorId(e.target.value)} className={field}>
            <option value="">— Zone libre —</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Zone / adresse</span>
          <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="ex. Quartier Gare" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Num label="Bénévoles" value={volunteers} onChange={setVolunteers} />
        <Num label="Portes frappées" value={doors} onChange={setDoors} />
        <Num label="Favorables" value={favorable} onChange={setFavorable} accent="emerald" />
        <Num label="Neutres" value={neutral} onChange={setNeutral} />
        <Num label="Défavorables" value={unfavorable} onChange={setUnfavorable} accent="red" />
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (sujets remontés, points d’attention…)" rows={2} className={cn(field, "resize-y")} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11.5px] text-muted-foreground">
          <span className="font-medium text-foreground">{fmtInt(met)}</span> personnes rencontrées (= favorables + neutres + défavorables)
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onDone} className="rounded-pill px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">Annuler</button>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    </form>
  );
}

function ReportRow({ report, sectorName }: { report: CanvassReport; sectorName: string | null }) {
  const op = report.favorable + report.neutral + report.unfavorable || 1;
  const label = sectorName ?? report.zone ?? "Zone libre";
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-foreground/5 bg-canvas/40 p-3">
      <div className="min-w-[140px] flex-1">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {fmtDate(report.date)} · {report.volunteers} bénévole{report.volunteers > 1 ? "s" : ""} · {fmtInt(report.doors)} portes
          {report.shared && " · équipe"}
        </p>
        {report.notes && <p className="mt-1 line-clamp-2 text-[11.5px] text-foreground/70">{report.notes}</p>}
      </div>
      <div className="w-40">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{fmtInt(report.met)} rencontrées</span>
        </div>
        <div className="mt-1 flex h-2 w-full overflow-hidden rounded-pill">
          <span className="bg-emerald-500" style={{ width: `${(report.favorable / op) * 100}%` }} />
          <span className="bg-slate-400" style={{ width: `${(report.neutral / op) * 100}%` }} />
          <span className="bg-red-500" style={{ width: `${(report.unfavorable / op) * 100}%` }} />
        </div>
        <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span className="text-emerald-600">{report.favorable}</span>
          <span>{report.neutral}</span>
          <span className="text-red-600">{report.unfavorable}</span>
        </div>
      </div>
      {report.mine && (
        <button type="button" onClick={() => void deleteReport(report.id)} aria-label="Supprimer" className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

export function Num({ label, value, onChange, accent }: { label: string; value: string; onChange: (v: string) => void; accent?: "emerald" | "red" }) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  const set = (v: number) => onChange(String(Math.max(0, v)));
  return (
    <label className="flex flex-col gap-1">
      <span className={cn("text-[10.5px] font-medium uppercase tracking-wide", accent === "emerald" ? "text-emerald-600" : accent === "red" ? "text-red-600" : "text-muted-foreground")}>{label}</span>
      {/* Compteur tactile : −/+ au pouce + saisie clavier directe. */}
      <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-surface focus-within:border-warm focus-within:ring-2 focus-within:ring-warm/20">
        <button
          type="button"
          onClick={() => set(n - 1)}
          aria-label={`Diminuer ${label}`}
          className="grid w-10 shrink-0 place-items-center text-[18px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] active:bg-foreground/[0.08] disabled:opacity-30"
          disabled={n <= 0}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-full min-w-0 border-x border-border bg-transparent py-2 text-center text-[15px] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => set(n + 1)}
          aria-label={`Augmenter ${label}`}
          className="grid w-10 shrink-0 place-items-center text-[18px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] active:bg-foreground/[0.08]"
        >
          +
        </button>
      </div>
    </label>
  );
}

export function Progress({ label, value, detail, accent, muted }: { label: string; value: number; detail: string; accent?: boolean; muted?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="font-medium">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{detail}</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-pill bg-surface-soft/70">
        <div
          className={cn("h-full rounded-pill transition-all", muted ? "bg-slate-300" : accent ? "bg-warm" : "bg-emerald-500")}
          style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function SentimentBar({ favorable, neutral, unfavorable }: { favorable: number; neutral: number; unfavorable: number }) {
  const op = favorable + neutral + unfavorable || 1;
  return (
    <div className="flex h-2.5 flex-1 overflow-hidden rounded-pill">
      <span className="bg-emerald-500" style={{ width: `${(favorable / op) * 100}%` }} />
      <span className="bg-slate-400" style={{ width: `${(neutral / op) * 100}%` }} />
      <span className="bg-red-500" style={{ width: `${(unfavorable / op) * 100}%` }} />
    </div>
  );
}

export function WeekRow({ w }: { w: WeekPoint }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[11.5px] text-muted-foreground">{w.label}</span>
      <SentimentBar favorable={w.favorable} neutral={w.neutral} unfavorable={w.unfavorable} />
      <span className="w-28 shrink-0 text-right text-[11.5px] tabular-nums">
        <span className="font-semibold text-emerald-600">{fmtPct(w.favPct)}</span>
        <span className="text-muted-foreground"> · {fmtInt(w.met)} renc.</span>
      </span>
    </div>
  );
}

export function SectorSentimentRow({ name, agg: a }: { name: string; agg: SectorAgg }) {
  const op = a.favorable + a.neutral + a.unfavorable || 1;
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 truncate text-[12.5px] font-medium" title={name}>{name}</span>
      <SentimentBar favorable={a.favorable} neutral={a.neutral} unfavorable={a.unfavorable} />
      <span className="w-28 shrink-0 text-right text-[11.5px] tabular-nums">
        <span className="font-semibold text-emerald-600">{fmtPct(a.favorable / op)}</span>
        <span className="text-muted-foreground"> · {fmtInt(a.met)} renc.</span>
      </span>
    </div>
  );
}

export function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-foreground/5 bg-canvas/40 p-3">
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

export function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} /> {label} <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}
