"use client";

import { useState } from "react";
import Link from "next/link";
import { Target, MapPin, Users, Plus, Trash2, Sparkles, Flag, Megaphone, Wand2, Info, Lock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@appica/ui-react/select";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import { usePins } from "@/lib/pins";
import { useScrutinDetail, fetchTerritoryBureaux } from "@/lib/queries";
import { fmtInt } from "@/lib/format";
import {
  useCampaign,
  useSectors,
  useHasTeam,
  useLoadState,
  saveCampaign,
  addSector,
  addSectorsBulk,
  updateSector,
  deleteSector,
  voteGoal,
  SECTOR_STATUS_LABELS,
  type Campaign,
  type CampaignTarget,
  type Sector,
  type SectorStatus,
} from "@/lib/campaign";
import { useCanEditPlan } from "@/app/(app)/espace/espace-shell";
import { PanelsSkeleton } from "@/components/skeleton";
import { ErrorState } from "@/components/error-state";

const pctToFrac = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : null;
};
const fracToPct = (f: number | null) => (f == null ? "" : String(Math.round(f * 1000) / 10));

const field =
  "text-[13px]";

export function EspaceCampaign() {
  const { loaded, error, retry } = useLoadState();
  const hasTeam = useHasTeam();
  if (error) return <ErrorState message="Impossible de charger la campagne." onRetry={retry} />;
  if (!loaded) return <PanelsSkeleton />;
  if (!hasTeam) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-pill bg-warm/15 text-warm">
          <Megaphone className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold tracking-tight">Lancez votre campagne en équipe</p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Le plan de campagne (territoire visé, objectif de voix, plan de terrain) se construit au
          niveau de l’équipe. Créez ou rejoignez une équipe pour commencer.
        </p>
        <Link
          href="/auth/team"
          className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90"
        >
          <Users className="h-4 w-4" /> Gérer mon équipe
        </Link>
      </div>
    );
  }
  return <CampaignContent />;
}

function CampaignContent() {
  const campaign = useCampaign();
  const sectors = useSectors();
  const target = campaign?.target ?? null;
  // Le plan (cible, objectif, découpage) appartient au responsable ; le compte
  // rendu de terrain (statut d'un secteur, contactés, favorables) reste ouvert
  // à tous les membres — c'est leur travail.
  const canEdit = useCanEditPlan();

  // Pré-remplissage des inscrits depuis les données du territoire (Légis. 2024 T1).
  const maille = target?.type === "circo" ? "circonscriptions" : "communes";
  const detail = useScrutinDetail(
    target && (target.type === "circo" || target.type === "commune") ? "legis-2024-t1" : null,
    maille,
    target?.id ?? null,
  );
  const dataRegistered = detail.data?.inscrits ?? null;

  const goal = voteGoal(campaign);
  const identified = sectors.reduce((s, x) => s + x.favorable, 0);
  const contacted = sectors.reduce((s, x) => s + x.contacted, 0);

  return (
    <div className="flex flex-col gap-4">
      {!canEdit && (
        <p className="inline-flex items-center gap-2 rounded-lg bg-surface-soft/70 px-3.5 py-2.5 text-[12px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Le plan est défini par le ou la responsable de campagne. Vous pouvez en revanche mettre à
          jour l’avancement de chaque secteur.
        </p>
      )}
      <TerritoryCard campaign={campaign} canEdit={canEdit} />
      <ObjectiveCard
        campaign={campaign}
        goal={goal}
        identified={identified}
        dataRegistered={dataRegistered}
        canEdit={canEdit}
      />
      <SectorsCard sectors={sectors} goal={goal} identified={identified} contacted={contacted} target={target} canEdit={canEdit} />
    </div>
  );
}

/* ── Territoire ─────────────────────────────────────────────────────────── */

function TerritoryCard({ campaign, canEdit }: { campaign: Campaign | null; canEdit: boolean }) {
  const pins = usePins();
  const targets = pins.filter((p) => p.type === "circo" || p.type === "commune");
  const target = campaign?.target ?? null;
  const [editing, setEditing] = useState(false);

  function pickTarget(key: string) {
    if (!key) return saveCampaign({ target: null });
    const p = targets.find((x) => `${x.type}:${x.id}` === key);
    if (p) {
      const t: CampaignTarget = { type: p.type, id: p.id, label: p.label, href: p.href };
      saveCampaign({ target: t });
      setEditing(false);
    }
  }

  return (
    <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Territoire de campagne
        </h2>
        {target && !editing && canEdit && (
          <Button type="button" onClick={() => setEditing(true)} className="text-[11.5px] text-warm hover:underline" variant="ghost" size="sm">
            Changer
          </Button>
        )}
      </div>

      {target && !editing ? (
        <div className="mt-2">
          <Link href={target.href} className="inline-flex items-center gap-1.5 text-[18px] font-semibold tracking-tight hover:text-warm">
            <MapPin className="h-4 w-4 text-warm" /> {target.label}
          </Link>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{campaign?.election || "Scrutin non précisé"}</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {targets.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              Épinglez votre circonscription ou votre commune (depuis sa fiche) pour la définir comme
              territoire de campagne.{" "}
              <Link href="/explorer" className="font-medium text-warm hover:underline">Explorer la carte</Link>
            </p>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Territoire visé</span>
              <Select
                value={target ? `${target.type}:${target.id}` : ""}
                onValueChange={(appicaValue) => pickTarget(String(appicaValue ?? ""))}
                size="sm"
              >
                <SelectTrigger className={field}><SelectValue /></SelectTrigger>
                <SelectContent>
                <SelectItem value="">Choisir parmi mes épingles…</SelectItem>
                {targets.map((p) => (
                  <SelectItem key={`${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>
                    {p.type === "circo" ? "Circo" : "Commune"} · {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Scrutin / intitulé</span>
            <Input
              key={`el-${campaign?.election ?? ""}`}
              defaultValue={campaign?.election ?? ""}
              onBlur={(e) => saveCampaign({ election: e.target.value.trim() || null })}
              placeholder="ex. Législatives 2027 — 1er tour"
              className={field} />
          </label>
        </div>
      )}
    </section>
  );
}

/* ── Objectif électoral ────────────────────────────────────────────────── */

function ObjectiveCard({
  campaign,
  goal,
  identified,
  dataRegistered,
  canEdit,
}: {
  campaign: Campaign | null;
  goal: number | null;
  identified: number;
  dataRegistered: number | null;
  canEdit: boolean;
}) {
  const reg = campaign?.registered ?? null;
  const progress = goal && goal > 0 ? Math.min(1, identified / goal) : 0;
  const remaining = goal != null ? Math.max(0, goal - identified) : null;
  const canPrefill = dataRegistered != null && dataRegistered !== reg;

  return (
    <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
      <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Flag className="h-3.5 w-3.5" /> Objectif électoral
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Inscrits</span>
          <Input
            key={`reg-${reg ?? ""}`}
            type="number"
            inputMode="numeric"
            defaultValue={reg ?? ""}
            onBlur={(e) => saveCampaign({ registered: e.target.value ? Math.round(Number(e.target.value)) : null })}
            placeholder="—"
            disabled={!canEdit}
            className={field} />
          {canPrefill && canEdit && (
            <Button
              type="button"
              onClick={() => saveCampaign({ registered: dataRegistered })}
              className="gap-1 text-[11px] text-warm hover:underline" variant="ghost" size="sm">
              <Sparkles className="h-3 w-3" /> Pré-remplir : {fmtInt(dataRegistered!)} (Légis. 2024)
            </Button>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Participation cible</span>
          <div className="relative">
            <Input
              key={`to-${campaign?.turnoutTarget ?? ""}`}
              type="number"
              defaultValue={fracToPct(campaign?.turnoutTarget ?? null)}
              onBlur={(e) => saveCampaign({ turnoutTarget: pctToFrac(e.target.value) })}
              placeholder="ex. 65"
              disabled={!canEdit}
              className={cn(field, "w-full pr-7")} />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Score cible</span>
          <div className="relative">
            <Input
              key={`sc-${campaign?.scoreTarget ?? ""}`}
              type="number"
              defaultValue={fracToPct(campaign?.scoreTarget ?? null)}
              onBlur={(e) => saveCampaign({ scoreTarget: pctToFrac(e.target.value) })}
              placeholder="ex. 35"
              disabled={!canEdit}
              className={cn(field, "w-full pr-7")} />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span>
          </div>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg bg-warm/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Voix nécessaires</p>
          <p className="text-[28px] font-semibold tracking-tight tabular-nums text-warm">
            {goal != null ? fmtInt(goal) : "—"}
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            {goal != null ? "Inscrits × participation cible × score cible" : "Complétez les 3 champs ci-dessus"}
          </p>
        </div>
        {goal != null && (
          <div className="sm:w-72">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Voix identifiées</span>
              <span className="font-semibold tabular-nums">{fmtInt(identified)} / {fmtInt(goal)}</span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-pill bg-surface-soft/70">
              <span className="block h-full rounded-pill bg-warm transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {remaining === 0 ? "Objectif atteint 🎯" : `Reste ${fmtInt(remaining ?? 0)} voix à convaincre`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Plan de terrain (secteurs) ────────────────────────────────────────── */

function SectorsCard({
  sectors,
  goal,
  identified,
  contacted,
  target,
  canEdit,
}: {
  sectors: Sector[];
  goal: number | null;
  identified: number;
  contacted: number;
  target: CampaignTarget | null;
  canEdit: boolean;
}) {
  const [name, setName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const done = sectors.filter((s) => s.status === "done").length;
  const coverage = sectors.length > 0 ? done / sectors.length : 0;
  const canGenerate = target?.type === "commune" || target?.type === "circo";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (await addSector({ name: name.trim() })) setName("");
  }

  async function generate() {
    if (!target || generating) return;
    setGenerating(true);
    setNotice(null);
    try {
      const { bureaux, splitCommunes } = await fetchTerritoryBureaux(target);
      if (bureaux.length === 0) {
        setNotice("Aucun bureau de vote trouvé pour ce territoire dans les données.");
      } else {
        const added = await addSectorsBulk(bureaux.map((b) => ({ name: b.name, registered: b.registered, bureauCode: b.code })));
        const skipped = bureaux.length - added;
        setNotice(
          `${added} secteur${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} depuis les bureaux de vote` +
            (skipped > 0 ? ` (${skipped} déjà présent${skipped > 1 ? "s" : ""})` : "") +
            (splitCommunes > 0
              ? ` · ${splitCommunes} commune${splitCommunes > 1 ? "s" : ""} partagée${splitCommunes > 1 ? "s" : ""} entre circos à ajouter à la main`
              : ""),
        );
      }
    } catch {
      setNotice("Impossible de générer les secteurs (données indisponibles).");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Plan de terrain · secteurs
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
          <span>{sectors.length} secteur{sectors.length > 1 ? "s" : ""}</span>
          <span>· {Math.round(coverage * 100)} % couverts</span>
          <span>· {fmtInt(contacted)} contacts</span>
          <span>· {fmtInt(identified)} favorables{goal ? ` / ${fmtInt(goal)}` : ""}</span>
        </div>
      </div>

      {canEdit && (
      <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ajouter un secteur (ex. Bureau 12 — Jean Jaurès)"
          className={cn(field, "min-w-[240px] flex-1")} />
        <Button type="submit" className="gap-1.5 rounded-pill text-[12px]" size="sm">
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </Button>
        {canGenerate && (
          <Button
            type="button"
            onClick={generate}
            disabled={generating}
            title="Créer un secteur par bureau de vote du territoire"
            className="gap-1.5 rounded-pill text-[12px]" variant="outline" size="sm">
            {generating ? <Spinner currentColor className="size-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
            Générer depuis les bureaux
          </Button>
        )}
      </form>
      )}

      {notice && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-warm/12 px-3 py-2 text-[12px] text-foreground/80">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
          <span>{notice}</span>
        </div>
      )}

      {sectors.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
          Découpez votre territoire en secteurs (bureaux de vote, quartiers) pour piloter le
          porte-à-porte et suivre les voix identifiées.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Secteur</th>
                <th className="py-1.5 px-2 font-medium">État</th>
                <th className="py-1.5 px-2 font-medium text-right">Inscrits</th>
                <th className="py-1.5 px-2 font-medium text-right">Contacts</th>
                <th className="py-1.5 px-2 font-medium text-right">Favorables</th>
                <th className="py-1.5 pl-2" />
              </tr>
            </thead>
            <tbody>
              {[...sectors]
                .sort((a, b) => (b.priority ?? -1) - (a.priority ?? -1))
                .map((s) => (
                  <SectorRow key={s.id} sector={s} canEdit={canEdit} />
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const STATUS_DOT: Record<SectorStatus, string> = {
  todo: "bg-slate-400",
  doing: "bg-amber-500",
  done: "bg-emerald-500",
};

function SectorRow({ sector, canEdit }: { sector: Sector; canEdit: boolean }) {
  const numCell =
    "w-20 rounded-md border border-transparent bg-canvas/40 px-2 py-1 text-right text-[12.5px] tabular-nums outline-none focus:border-warm focus:bg-surface";
  return (
    <tr className="border-t border-border/50">
      <td className="py-2 pr-2 font-medium">
        {sector.name}
        {sector.priority != null && (
          <span
            title="Priorité de ciblage"
            className={cn(
              "ml-2 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold align-middle",
              sector.priority >= 66 ? "bg-red-100 text-red-700" : sector.priority >= 40 ? "bg-amber-100 text-amber-700" : "bg-surface-soft text-muted-foreground",
            )}
          >
            P{sector.priority}
          </span>
        )}
      </td>
      <td className="px-2 py-2">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[sector.status])} />
          <Select value={sector.status} onValueChange={(appicaValue) => updateSector(sector.id, { status: String(appicaValue ?? "") as SectorStatus })} size="sm">
            <SelectTrigger className="rounded border-border/60 text-[11.5px]"><SelectValue /></SelectTrigger>
            <SelectContent>
            {(["todo", "doing", "done"] as SectorStatus[]).map((st) => (
              <SelectItem key={st} value={st}>{SECTOR_STATUS_LABELS[st]}</SelectItem>
            ))}
          </SelectContent>
          </Select>
        </span>
      </td>
      <td className="px-2 py-2 text-right">
        <Input
          type="number"
          defaultValue={sector.registered ?? ""}
          onBlur={(e) => updateSector(sector.id, { registered: e.target.value ? Math.round(Number(e.target.value)) : null })}
          className={numCell}
          disabled={!canEdit}
          placeholder="—" />
      </td>
      <td className="px-2 py-2 text-right">
        <Input
          type="number"
          defaultValue={sector.contacted}
          key={`c-${sector.contacted}`}
          onBlur={(e) => updateSector(sector.id, { contacted: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
          className={numCell} />
      </td>
      <td className="px-2 py-2 text-right">
        <Input
          type="number"
          defaultValue={sector.favorable}
          key={`f-${sector.favorable}`}
          onBlur={(e) => updateSector(sector.id, { favorable: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
          className={numCell} />
      </td>
      <td className="py-2 pl-2 text-right">
        {canEdit && (
          <Button
            type="button"
            onClick={() => deleteSector(sector.id)}
            aria-label="Supprimer le secteur"
            className="h-6 w-6 rounded hover:bg-red-50 hover:text-red-600" variant="ghost" size="icon-sm">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </td>
    </tr>
  );
}
