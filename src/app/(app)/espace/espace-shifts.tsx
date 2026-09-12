"use client";

import { useState } from "react";
import { Plus, CalendarClock, MapPin, Users, Check, Trash2, Pencil, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@appica/ui-react/select";
import { Checkbox } from "@appica/ui-react/checkbox";
import { Textarea } from "@appica/ui-react/textarea";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import {
  useShifts,
  useLoadState,
  addShift,
  updateShift,
  deleteShift,
  joinShift,
  leaveShift,
  SHIFT_KIND_LABELS,
  type Shift,
  type ShiftKind,
} from "@/lib/shifts";
import { memberName, memberInitials, memberRolesOf, type WsContext } from "@/app/(app)/espace/types";
import { TabSkeleton } from "@/components/skeleton";
import { ErrorState } from "@/components/error-state";

const KINDS = Object.keys(SHIFT_KIND_LABELS) as ShiftKind[];
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : null);

// Les champs Appica portent leur propre cadre (bordure, fond, focus) :
// il ne reste ici que l'échelle typographique du contexte.
const field = "text-[13px]";

export function EspaceShifts({ ctx }: { ctx: WsContext }) {
  const shifts = useShifts();
  const { loaded, error, retry } = useLoadState();
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");
  const [showForm, setShowForm] = useState(false);

  if (error) return <ErrorState message="Impossible de charger les créneaux." onRetry={retry} />;
  if (!loaded) return <TabSkeleton />;

  const today = todayISO();
  const visible = shifts.filter((s) => (scope === "upcoming" ? s.date >= today : true));

  // Regroupement par date
  const groups = new Map<string, Shift[]>();
  for (const s of visible) {
    const arr = groups.get(s.date) ?? [];
    arr.push(s);
    groups.set(s.date, arr);
  }
  const dates = [...groups.keys()].sort();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={scope === "upcoming"} onClick={() => setScope("upcoming")}>À venir</Chip>
        <Chip active={scope === "all"} onClick={() => setScope("all")}>Toutes · {shifts.length}</Chip>
        <Button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto gap-1.5 rounded-pill text-[12px]" size="sm">
          <Plus className="h-3.5 w-3.5" /> Nouveau créneau
        </Button>
      </div>

      {showForm && <ShiftForm ctx={ctx} onDone={() => setShowForm(false)} />}

      {dates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-6 py-14 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-pill bg-warm/15 text-warm">
            <CalendarClock className="h-5 w-5" />
          </span>
          <p className="text-[14px] font-semibold">Aucun créneau {scope === "upcoming" ? "à venir" : ""}</p>
          <p className="max-w-md text-[12.5px] text-muted-foreground">
            Planifiez vos sessions de terrain (porte-à-porte, tractage, permanences) et laissez les
            bénévoles s’inscrire.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {dates.map((d) => (
            <div key={d}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground first-letter:uppercase">
                {fmtDate(d)}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {groups.get(d)!.map((s) => (
                  <ShiftCard key={s.id} shift={s} ctx={ctx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.04] text-foreground/80 hover:bg-foreground/[0.08]",
      )} variant="ghost" size="sm">
      {children}
    </Button>
  );
}

function ShiftForm({ ctx, initial, onDone }: { ctx: WsContext; initial?: Shift; onDone: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<ShiftKind>(initial?.kind ?? "porte");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [start, setStart] = useState(initial?.startTime?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(initial?.endTime?.slice(0, 5) ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [capacity, setCapacity] = useState(initial?.capacity != null ? String(initial.capacity) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [shared, setShared] = useState<boolean>(initial ? initial.shared : !!ctx.teamId);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || busy) return;
    setBusy(true);
    const payload = {
      title: title.trim(),
      kind,
      date,
      startTime: start || null,
      endTime: end || null,
      location: location.trim() || null,
      capacity: capacity ? Math.max(0, Math.round(Number(capacity))) : null,
      notes: notes.trim() || null,
      shared: shared && !!ctx.teamId,
    };
    const saved = initial ? await updateShift(initial.id, payload) : await addShift(payload);
    setBusy(false);
    if (saved) onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Intitulé (ex. Porte-à-porte Quartier Gare)" className={cn(field, "font-medium")} />
      <div className="grid gap-2 sm:grid-cols-4">
        <Select value={kind} onValueChange={(appicaValue) => setKind(String(appicaValue ?? "") as ShiftKind)} size="sm">
          <SelectTrigger className={field}><SelectValue /></SelectTrigger>
          <SelectContent>
          {KINDS.map((k) => <SelectItem key={k} value={k}>{SHIFT_KIND_LABELS[k]}</SelectItem>)}
        </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} title="Début" />
        <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} title="Fin" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Point de RDV / lieu" className={field} />
        <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Bénévoles visés" className={cn(field, "sm:w-44")} />
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (consignes, matériel…)" rows={2} className={cn(field, "resize-y")} />
      <div className="flex flex-wrap items-center gap-3">
        {ctx.teamId && (
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/80">
            <Checkbox checked={shared} onCheckedChange={setShared} />
            <Users className="h-3.5 w-3.5" /> Partagé avec l’équipe
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" onClick={onDone} className="rounded-pill text-[12.5px]" variant="ghost" size="sm">Annuler</Button>
          <Button type="submit" disabled={!title.trim() || busy} className="gap-1.5 rounded-pill text-[12.5px]" size="sm">
            {busy && <Spinner currentColor className="size-3.5" />} {initial ? "Enregistrer" : "Planifier"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function ShiftCard({ shift, ctx }: { shift: Shift; ctx: WsContext }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <ShiftForm ctx={ctx} initial={shift} onDone={() => setEditing(false)} />;

  const time = [fmtTime(shift.startTime), fmtTime(shift.endTime)].filter(Boolean).join(" – ");
  const count = shift.signups.length;
  const full = shift.capacity != null && count >= shift.capacity;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-foreground/5 bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{shift.title}</p>
          <p className="text-[11.5px] text-muted-foreground">{SHIFT_KIND_LABELS[shift.kind]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shift.shared && <Users className="h-3.5 w-3.5 text-warm" />}
          {shift.mine && (
            <>
              <Button type="button" onClick={() => setEditing(true)} aria-label="Modifier" className="h-6 w-6 rounded" variant="soft" size="icon-sm">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" onClick={() => void deleteShift(shift.id)} aria-label="Supprimer" className="h-6 w-6 rounded hover:bg-red-50 hover:text-red-600" variant="ghost" size="icon-sm">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        {time && (
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {time}</span>
        )}
        {shift.location && (
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {shift.location}</span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {count}{shift.capacity != null ? ` / ${shift.capacity}` : ""} inscrit{count > 1 ? "s" : ""}
        </span>
      </div>

      {shift.notes && <p className="text-[12px] text-foreground/75">{shift.notes}</p>}

      <div className="mt-0.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {shift.signups.slice(0, 6).map((uid) => {
            const roles = memberRolesOf(ctx.members, uid);
            const title = memberName(ctx.members, uid) + (roles.length ? ` · ${roles.map((r) => r.name).join(", ")}` : "");
            return (
              <span
                key={uid}
                title={title}
                className="grid h-6 w-6 place-items-center rounded-full bg-surface-soft text-[9px] font-semibold text-foreground/70"
              >
                {memberInitials(memberName(ctx.members, uid))}
              </span>
            );
          })}
          {count === 0 && <span className="text-[11px] text-muted-foreground">Aucun inscrit</span>}
        </div>
        <Button
          type="button"
          onClick={() => (shift.joined ? leaveShift(shift.id) : joinShift(shift.id))}
          disabled={!shift.joined && full}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50",
            shift.joined ? "bg-warm/15 text-foreground" : "bg-primary text-primary-foreground hover:opacity-90",
          )} variant="ghost" size="sm">
          {shift.joined ? <><Check className="h-3.5 w-3.5" /> Inscrit</> : full ? "Complet" : "Je m’inscris"}
        </Button>
      </div>
    </div>
  );
}
