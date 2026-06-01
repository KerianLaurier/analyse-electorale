"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, Plus, Users, Trash2, Loader2, Info, ClipboardList, Target, TrendingUp, LayoutGrid, Search, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReports, addReport, deleteReport, summarize, bySector, weeklyTrend, type CanvassReport, type SectorAgg } from "@/lib/canvass";
import { useSectors, useHasTeam, updateSector, type Sector } from "@/lib/campaign";
import {
  fmtInt,
  fmtPct,
  todayISO,
  fmtDate,
  field,
  Chip,
  Num,
  WeekRow,
  SectorSentimentRow,
  KPI,
  Legend,
} from "@/app/espace/espace-canvass";

const STATUS_DOT: Record<string, string> = { todo: "bg-slate-300", doing: "bg-amber-500", done: "bg-emerald-500" };

export function EspacePhoning() {
  const hasTeam = useHasTeam();
  if (!hasTeam) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-black/10 bg-surface/60 px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-pill bg-warm/15 text-warm">
          <Phone className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold tracking-tight">Le phoning se pilote en équipe</p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Créez ou rejoignez une équipe pour organiser vos sessions d’appels et suivre le sondage terrain.
        </p>
        <Link href="/auth/team" className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
          <Users className="h-4 w-4" /> Gérer mon équipe
        </Link>
      </div>
    );
  }
  return <PhoningContent />;
}

function PhoningContent() {
  const reports = useReports().filter((r) => r.channel === "phone");
  const sectors = useSectors();
  const summary = useMemo(() => summarize(reports), [reports]);
  const agg = useMemo(() => bySector(reports), [reports]);
  const trend = useMemo(() => weeklyTrend(reports), [reports]);
  const [showForm, setShowForm] = useState(false);
  const [presetSector, setPresetSector] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState<"all" | "todo" | "doing" | "done">("all");
  const [planQuery, setPlanQuery] = useState("");
  const [planExpanded, setPlanExpanded] = useState(false);

  const sortedSectors = useMemo(
    () => [...sectors].sort((a, b) => (b.priority ?? -1) - (a.priority ?? -1)),
    [sectors],
  );
  const coveredSectors = sectors.filter((s) => s.status === "done").length;

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

  const sectorSentiment = useMemo(
    () =>
      [...agg.entries()]
        .map(([id, a]) => ({ sector: sectors.find((s) => s.id === id), agg: a }))
        .filter((x) => x.sector)
        .sort((a, b) => b.agg.met - a.agg.met) as { sector: Sector; agg: SectorAgg }[],
    [agg, sectors],
  );

  function openForm(sectorId: string | null) {
    setPresetSector(sectorId);
    setShowForm(true);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Sondage terrain (phoning) ────────────────────────────────── */}
      <section className="rounded-lg border border-black/5 bg-surface p-5 shadow-card">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Sondage terrain · phoning
        </h2>
        {summary.opinions === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Saisissez vos premières sessions d’appels pour faire émerger le sentiment de terrain.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[14px]">
              <span className="text-[26px] font-semibold tracking-tight text-emerald-600">{fmtPct(summary.favPct)}</span>{" "}
              de favorables sur <span className="font-semibold">{fmtInt(summary.opinions)}</span> personnes jointes
              <span className="text-muted-foreground"> ({summary.sessions} session{summary.sessions > 1 ? "s" : ""})</span>.
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
              <Info className="mt-0.5 h-3 w-3 shrink-0" /> Donnée déclarative issue du phoning — indicative, non représentative d’un sondage scientifique. Fusionnée au sondage terrain global (vue d’ensemble).
            </p>
          </>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Sessions" value={fmtInt(summary.sessions)} />
          <KPI label="Appels passés" value={fmtInt(summary.doors)} />
          <KPI label="Joints" value={fmtInt(summary.met)} />
          <KPI label="Taux de réponse" value={summary.doors ? fmtPct(summary.contactRate) : "—"} />
        </div>
      </section>

      {/* ── Évolution hebdomadaire ────────────────────────────────────── */}
      {trend.length > 0 && (
        <section className="rounded-lg border border-black/5 bg-surface p-5 shadow-card">
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

      {/* ── File d'appels (plan d'action) ─────────────────────────────── */}
      <section className="rounded-lg border border-black/5 bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> File d’appels · secteurs
          </h2>
          <span className="text-[11.5px] text-muted-foreground">{sortedSectors.length} secteurs · {coveredSectors} couverts</span>
        </div>
        {sortedSectors.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-black/10 bg-surface/60 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            Aucun secteur. Construisez votre plan de terrain dans l’onglet <span className="font-medium">Campagne</span> ou
            poussez les bureaux prioritaires depuis le <Link href="/analyser/ciblage" className="font-medium text-warm hover:underline">ciblage</Link>.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Chip active={planFilter === "all"} onClick={() => { setPlanFilter("all"); setPlanExpanded(false); }}>Tous · {sortedSectors.length}</Chip>
              <Chip active={planFilter === "todo"} onClick={() => { setPlanFilter("todo"); setPlanExpanded(false); }}>À traiter · {statusCounts.todo}</Chip>
              <Chip active={planFilter === "doing"} onClick={() => { setPlanFilter("doing"); setPlanExpanded(false); }}>En cours · {statusCounts.doing}</Chip>
              <Chip active={planFilter === "done"} onClick={() => { setPlanFilter("done"); setPlanExpanded(false); }}>Couvert · {statusCounts.done}</Chip>
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={planQuery}
                  onChange={(e) => { setPlanQuery(e.target.value); setPlanExpanded(false); }}
                  placeholder="Rechercher un secteur…"
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
                    <PhoneRow key={s.id} sector={s} stat={agg.get(s.id)} onLog={() => openForm(s.id)} />
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

      {/* ── Sentiment par secteur ────────────────────────────────────── */}
      {sectorSentiment.length > 0 && (
        <section className="rounded-lg border border-black/5 bg-surface p-5 shadow-card">
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5" /> Sentiment par secteur
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Où le téléphone remonte le plus de soutiens.</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {sectorSentiment.map(({ sector, agg: a }) => (
              <SectorSentimentRow key={sector.id} name={sector.name} agg={a} />
            ))}
          </div>
        </section>
      )}

      {/* ── Comptes-rendus ───────────────────────────────────────────── */}
      <section className="rounded-lg border border-black/5 bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" /> Sessions d’appels · {reports.length}
          </h2>
          <button type="button" onClick={() => openForm(null)} className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Nouvelle session
          </button>
        </div>

        {showForm && (
          <PhoneForm sectors={sortedSectors} presetSector={presetSector} onDone={() => setShowForm(false)} />
        )}

        {reports.length === 0 && !showForm ? (
          <p className="mt-3 rounded-lg border border-dashed border-black/10 bg-surface/60 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            Aucune session d’appels. Après chaque session de phoning, saisissez les chiffres pour
            alimenter le sondage terrain.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {reports.map((r) => (
              <PhoneReportRow key={r.id} report={r} sectorName={sectors.find((s) => s.id === r.sectorId)?.name ?? null} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PhoneRow({ sector, stat, onLog }: { sector: Sector; stat?: { met: number; favorable: number }; onLog: () => void }) {
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
        placeholder="Notes / liste d’appels…"
        className="min-w-[120px] flex-1 rounded border border-transparent bg-canvas/40 px-2 py-1 text-[11.5px] outline-none focus:border-warm focus:bg-surface"
      />
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {stat ? (
          <><span className="font-medium text-foreground">{fmtInt(stat.met)}</span> joints · {fmtInt(stat.favorable)} fav.</>
        ) : (
          "—"
        )}
      </span>
      <button type="button" onClick={onLog} title="Saisir une session d’appels" className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-black/[0.04] px-2.5 py-1.5 text-[11.5px] font-medium text-foreground hover:bg-black/[0.08]">
        <Phone className="h-3.5 w-3.5" /> Appeler
      </button>
    </div>
  );
}

function PhoneForm({ sectors, presetSector, onDone }: { sectors: Sector[]; presetSector: string | null; onDone: () => void }) {
  const hasTeam = useHasTeam();
  const [sectorId, setSectorId] = useState<string>(presetSector ?? "");
  const [zone, setZone] = useState("");
  const [date, setDate] = useState(todayISO());
  const [volunteers, setVolunteers] = useState("1");
  const [calls, setCalls] = useState("");
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
      channel: "phone",
      sectorId: sectorId || null,
      zone: zone.trim() || null,
      date,
      volunteers: num(volunteers) || 1,
      doors: num(calls),
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
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Liste / cible</span>
          <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="ex. Adhérents 2024" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <Num label="Appelants" value={volunteers} onChange={setVolunteers} />
        <Num label="Appels passés" value={calls} onChange={setCalls} />
        <Num label="Favorables" value={favorable} onChange={setFavorable} accent="emerald" />
        <Num label="Neutres" value={neutral} onChange={setNeutral} />
        <Num label="Défavorables" value={unfavorable} onChange={setUnfavorable} accent="red" />
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (objections, sujets remontés…)" rows={2} className={cn(field, "resize-y")} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11.5px] text-muted-foreground">
          <span className="font-medium text-foreground">{fmtInt(met)}</span> personnes jointes avec avis (= favorables + neutres + défavorables)
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

function PhoneReportRow({ report, sectorName }: { report: CanvassReport; sectorName: string | null }) {
  const op = report.favorable + report.neutral + report.unfavorable || 1;
  const label = sectorName ?? report.zone ?? "Zone libre";
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-black/5 bg-canvas/40 p-3">
      <div className="min-w-[140px] flex-1">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {fmtDate(report.date)} · {report.volunteers} appelant{report.volunteers > 1 ? "s" : ""} · {fmtInt(report.doors)} appels
          {report.shared && " · équipe"}
        </p>
        {report.notes && <p className="mt-1 line-clamp-2 text-[11.5px] text-foreground/70">{report.notes}</p>}
      </div>
      <div className="w-40">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{fmtInt(report.met)} joints</span>
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
