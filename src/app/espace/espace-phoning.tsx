"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Phone, Plus, Users, Trash2, Loader2, Info, ArrowLeft, ListChecks, Target,
  PhoneCall, ChevronRight, Upload, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  usePhoneLists, usePhoneContacts, useLoadState as usePhoningLoad, createList, deleteList, addNumbers, logCall, deleteContact,
  summarizePhoning, isHandled, CALL_STATUS_LABELS, CALL_OPINION_LABELS,
  type PhoneList, type PhoneContact, type CallStatus, type CallOpinion,
} from "@/lib/phoning";
import { useHasTeam, useLoadState as useCampaignLoad } from "@/lib/campaign";
import { fmtInt, fmtPct, KPI, Legend, Progress } from "@/app/espace/espace-canvass";
import { PanelsSkeleton } from "@/components/skeleton";
import { ErrorState } from "@/components/error-state";
import { ConfirmButton } from "@/components/confirm-button";

const STATUS_ORDER: CallStatus[] = ["joint", "repondeur", "occupe", "faux", "refus", "rappeler"];
const STATUS_TONE: Record<CallStatus, string> = {
  todo: "bg-surface-soft text-muted-foreground",
  joint: "bg-emerald-100 text-emerald-700",
  repondeur: "bg-amber-100 text-amber-700",
  occupe: "bg-amber-100 text-amber-700",
  faux: "bg-surface-soft text-muted-foreground",
  refus: "bg-red-100 text-red-700",
  rappeler: "bg-sky-100 text-sky-700",
};
const OPINION_TONE: Record<CallOpinion, string> = {
  favorable: "bg-emerald-500",
  neutre: "bg-slate-400",
  defavorable: "bg-red-500",
};

export function EspacePhoning() {
  const phoningLoad = usePhoningLoad();
  const campaignLoad = useCampaignLoad();
  const hasTeam = useHasTeam();
  if (phoningLoad.error || campaignLoad.error)
    return <ErrorState message="Impossible de charger le phoning." onRetry={() => { phoningLoad.retry(); campaignLoad.retry(); }} />;
  if (!phoningLoad.loaded || !campaignLoad.loaded) return <PanelsSkeleton />;
  if (!hasTeam) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-pill bg-warm/15 text-warm">
          <Phone className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold tracking-tight">Le phoning se pilote en équipe</p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Créez ou rejoignez une équipe pour bâtir des listes d’appels, les confier aux bénévoles et
          consigner le résultat de chaque appel.
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
  const lists = usePhoneLists();
  const contacts = usePhoneContacts();
  const [openListId, setOpenListId] = useState<string | null>(null);
  const openList = lists.find((l) => l.id === openListId) ?? null;

  if (openList) {
    return (
      <ListWorkspace
        list={openList}
        contacts={contacts.filter((c) => c.listId === openList.id)}
        onBack={() => setOpenListId(null)}
      />
    );
  }
  return <ListsOverview lists={lists} contacts={contacts} onOpen={setOpenListId} />;
}

// ── Vue d'ensemble : sondage + listes ───────────────────────────────────────

function ListsOverview({
  lists,
  contacts,
  onOpen,
}: {
  lists: PhoneList[];
  contacts: PhoneContact[];
  onOpen: (id: string) => void;
}) {
  const summary = useMemo(() => summarizePhoning(contacts), [contacts]);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      {/* Sondage terrain phoning */}
      <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Sondage terrain · phoning
        </h2>
        {summary.opinions === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Créez une liste, importez des numéros et lancez les appels pour faire émerger le sentiment.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[14px]">
              <span className="text-[26px] font-semibold tracking-tight text-emerald-600">{fmtPct(summary.favPct)}</span>{" "}
              de favorables sur <span className="font-semibold">{fmtInt(summary.opinions)}</span> personnes jointes.
            </p>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-pill">
              <span className="bg-emerald-500" style={{ width: `${summary.favPct * 100}%` }} />
              <span className="bg-slate-400" style={{ width: `${summary.neuPct * 100}%` }} />
              <span className="bg-red-500" style={{ width: `${summary.defPct * 100}%` }} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              <Legend color="bg-emerald-500" label="Favorables" value={`${fmtInt(summary.favorable)} · ${fmtPct(summary.favPct)}`} />
              <Legend color="bg-slate-400" label="Neutres" value={`${fmtInt(summary.neutre)} · ${fmtPct(summary.neuPct)}`} />
              <Legend color="bg-red-500" label="Défavorables" value={`${fmtInt(summary.defavorable)} · ${fmtPct(summary.defPct)}`} />
            </div>
            <p className="mt-2 inline-flex items-start gap-1.5 text-[10.5px] text-muted-foreground/80">
              <Info className="mt-0.5 h-3 w-3 shrink-0" /> Donnée déclarative issue du phoning — indicative, fusionnée au sondage terrain global (vue d’ensemble).
            </p>
          </>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Numéros" value={fmtInt(summary.total)} />
          <KPI label="Appelés" value={fmtInt(summary.handled)} />
          <KPI label="Joints" value={fmtInt(summary.reached)} />
          <KPI label="Taux de réponse" value={summary.handled ? fmtPct(summary.reachRate) : "—"} />
        </div>
      </section>

      {/* Listes d'appels */}
      <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" /> Listes d’appels · {lists.length}
          </h2>
          <button type="button" onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Nouvelle liste
          </button>
        </div>

        {creating && <NewListForm onDone={() => setCreating(false)} />}

        {lists.length === 0 && !creating ? (
          <p className="mt-3 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            Aucune liste. Créez une liste d’appels (ex. « Adhérents 2024 ») puis importez les numéros à contacter.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {lists.map((l) => (
              <ListCard key={l.id} list={l} contacts={contacts.filter((c) => c.listId === l.id)} onOpen={() => onOpen(l.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ListCard({ list, contacts, onOpen }: { list: PhoneList; contacts: PhoneContact[]; onOpen: () => void }) {
  const s = summarizePhoning(contacts);
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col gap-2 rounded-lg border border-foreground/5 bg-canvas/40 p-4 text-left transition-colors hover:border-warm/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{list.name}</p>
          {list.description && <p className="truncate text-[11.5px] text-muted-foreground">{list.description}</p>}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <Progress label="Avancement" value={s.progress} detail={`${fmtInt(s.handled)} / ${fmtInt(s.total)} appelés`} />
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>{fmtInt(s.reached)} joints</span>
        {s.opinions > 0 && <span className="text-emerald-600">{fmtPct(s.favPct)} favorables</span>}
      </div>
    </button>
  );
}

function NewListForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    await createList(name.trim(), description.trim() || null);
    setBusy(false);
    onDone();
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-surface p-4 shadow-card sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Nom de la liste</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Adhérents 2024" className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20" />
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Description (optionnel)</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex. Sympathisants à mobiliser" className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20" />
      </label>
      <button type="submit" disabled={busy || !name.trim()} className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Créer
      </button>
    </form>
  );
}

// ── Espace d'une liste : import + file d'appels ─────────────────────────────

function ListWorkspace({ list, contacts, onBack }: { list: PhoneList; contacts: PhoneContact[]; onBack: () => void }) {
  const s = summarizePhoning(contacts);
  const [importing, setImporting] = useState(false);

  const todo = contacts.filter((c) => !isHandled(c.status));
  const handled = contacts.filter((c) => isHandled(c.status));
  const callback = contacts.filter((c) => c.status === "rappeler");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Toutes les listes
        </button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight">{list.name}</h2>
            {list.description && <p className="text-[12.5px] text-muted-foreground">{list.description}</p>}
          </div>
          <ConfirmButton
            onConfirm={() => void deleteList(list.id)}
            ariaLabel={`Supprimer la liste ${list.name} et tous ses numéros`}
            className="inline-flex items-center gap-1.5 rounded-pill bg-foreground/[0.04] px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            confirmClassName="bg-destructive/10 text-destructive"
            confirmContent={<><Trash2 className="h-3.5 w-3.5" /> Supprimer la liste et ses numéros ?</>}
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer la liste
          </ConfirmButton>
        </div>
      </div>

      <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label="Numéros" value={fmtInt(s.total)} />
          <KPI label="Appelés" value={fmtInt(s.handled)} />
          <KPI label="Joints" value={fmtInt(s.reached)} />
          <KPI label="Favorables" value={s.opinions ? fmtPct(s.favPct) : "—"} />
        </div>
        <div className="mt-4">
          <Progress label="Avancement de la liste" value={s.progress} detail={`${fmtInt(s.handled)} / ${fmtInt(s.total)}`} accent />
        </div>
      </section>

      {/* Import de numéros */}
      <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Upload className="h-3.5 w-3.5" /> Importer des numéros
          </h3>
          <button type="button" onClick={() => setImporting((v) => !v)} className="text-[11.5px] font-medium text-warm hover:underline">
            {importing ? "Masquer" : "Ajouter des numéros"}
          </button>
        </div>
        {importing && <ImportForm listId={list.id} onDone={() => setImporting(false)} />}
      </section>

      {/* À rappeler */}
      {callback.length > 0 && (
        <section className="rounded-lg border border-sky-200 bg-sky-50/50 p-5">
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-700">
            <PhoneCall className="h-3.5 w-3.5" /> À rappeler · {callback.length}
          </h3>
          <div className="mt-3 flex flex-col divide-y divide-border/50">
            {callback.map((c) => <ContactRow key={c.id} contact={c} />)}
          </div>
        </section>
      )}

      {/* File à appeler */}
      <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
        <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Phone className="h-3.5 w-3.5" /> À appeler · {todo.length}
        </h3>
        {todo.length === 0 ? (
          <p className="mt-3 px-1 py-6 text-center text-[12.5px] text-muted-foreground">
            {s.total === 0 ? "Importez des numéros pour démarrer les appels." : "Tous les numéros ont été appelés 🎉"}
          </p>
        ) : (
          <div className="mt-3 flex flex-col divide-y divide-border/50">
            {todo.map((c) => <ContactRow key={c.id} contact={c} defaultOpen={false} />)}
          </div>
        )}
      </section>

      {/* Traités */}
      {handled.length > 0 && (
        <section className="rounded-lg border border-foreground/5 bg-surface p-5 shadow-card">
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Check className="h-3.5 w-3.5" /> Traités · {handled.length}
          </h3>
          <div className="mt-3 flex flex-col divide-y divide-border/50">
            {handled.map((c) => <ContactRow key={c.id} contact={c} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function ImportForm({ listId, onDone }: { listId: string; onDone: () => void }) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const parsed = useMemo(() => parseNumbers(raw), [raw]);

  async function submit() {
    if (busy || parsed.length === 0) return;
    setBusy(true);
    const n = await addNumbers(listId, parsed);
    setBusy(false);
    setNotice(`${n} numéro${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""}.`);
    setRaw("");
    if (n > 0) onDone();
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={5}
        placeholder={"Un numéro par ligne. Nom optionnel après une virgule :\n06 12 34 56 78, Marie Dupont\n0698765432\n+33611223344, Paul"}
        className="rounded-md border border-border bg-surface px-2.5 py-2 text-[12.5px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20"
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11.5px] text-muted-foreground">
          {parsed.length > 0 ? <><span className="font-medium text-foreground">{parsed.length}</span> numéro{parsed.length > 1 ? "s" : ""} détecté{parsed.length > 1 ? "s" : ""}</> : "Collez vos numéros ci-dessus."}
        </span>
        {notice && <span className="inline-flex items-center gap-1 text-[12px] text-emerald-700"><Check className="h-3.5 w-3.5" /> {notice}</span>}
        <button type="button" onClick={submit} disabled={busy || parsed.length === 0} className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Importer
        </button>
      </div>
    </div>
  );
}

function ContactRow({ contact, defaultOpen }: { contact: PhoneContact; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const handled = isHandled(contact.status);
  return (
    <div className="py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium tabular-nums">{contact.phone}</span>
            {contact.name && <span className="block truncate text-[11px] text-muted-foreground">{contact.name}</span>}
          </span>
        </button>
        {contact.opinion && <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", OPINION_TONE[contact.opinion])} title={CALL_OPINION_LABELS[contact.opinion]} />}
        <span className={cn("shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-medium", STATUS_TONE[contact.status])}>
          {CALL_STATUS_LABELS[contact.status]}
        </span>
        {handled ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-foreground/[0.04] px-3 py-2 text-[12px] font-medium text-foreground hover:bg-foreground/[0.08]"
          >
            Modifier
          </button>
        ) : (
          // Mobile : compose le numéro (tel:) ET ouvre la saisie du résultat.
          <a
            href={`tel:${contact.phone.replace(/[^+0-9]/g, "")}`}
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground hover:opacity-90"
          >
            <PhoneCall className="h-3.5 w-3.5" /> Appeler
          </a>
        )}
      </div>
      {open && <CallForm contact={contact} onDone={() => setOpen(false)} />}
    </div>
  );
}

function CallForm({ contact, onDone }: { contact: PhoneContact; onDone: () => void }) {
  const [status, setStatus] = useState<CallStatus>(contact.status === "todo" ? "joint" : contact.status);
  const [opinion, setOpinion] = useState<CallOpinion | null>(contact.opinion);
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    await logCall(contact.id, {
      status,
      opinion: status === "joint" ? opinion : null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg border border-border/60 bg-canvas/40 p-3">
      <div>
        <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Résultat de l’appel</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatus(st)}
              className={cn("rounded-pill px-3 py-2 text-[12.5px] font-medium transition-colors", status === st ? "bg-primary text-primary-foreground" : "bg-foreground/[0.04] text-foreground/80 hover:bg-foreground/[0.08]")}
            >
              {CALL_STATUS_LABELS[st]}
            </button>
          ))}
        </div>
      </div>

      {status === "joint" && (
        <div>
          <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Opinion</p>
          <div className="flex flex-wrap gap-1.5">
            {(["favorable", "neutre", "defavorable"] as CallOpinion[]).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setOpinion((v) => (v === op ? null : op))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-[12.5px] font-medium transition-colors",
                  opinion === op ? "bg-primary text-primary-foreground" : "bg-foreground/[0.04] text-foreground/80 hover:bg-foreground/[0.08]",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", OPINION_TONE[op])} /> {CALL_OPINION_LABELS[op]}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (objections, sujets, heure de rappel…)"
        className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20"
      />

      <div className="flex items-center gap-2">
        <ConfirmButton
          onConfirm={() => void deleteContact(contact.id)}
          ariaLabel="Supprimer le numéro"
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          confirmClassName="w-auto whitespace-nowrap px-2.5 text-[12px] font-medium bg-destructive/10 text-destructive"
          confirmContent="Supprimer ?"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ConfirmButton>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onDone} className="rounded-pill px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground">Annuler</button>
          <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-5 py-2 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

/** Parse un collage : une entrée par ligne, « numéro[, nom] ». */
function parseNumbers(raw: string): { phone: string; name?: string | null }[] {
  const out: { phone: string; name?: string | null }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(/[,;\t]/).map((x) => x.trim());
    const phone = parts[0];
    if (!phone) continue;
    const name = parts.slice(1).join(" ").trim() || null;
    out.push({ phone, name });
  }
  return out;
}
