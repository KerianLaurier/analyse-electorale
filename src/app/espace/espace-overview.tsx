"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ListTodo, Star, StickyNote, CalendarClock, MapPin, ArrowRight, Target, DoorOpen, Contact, Clock, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTasks, TASK_KIND_LABELS, useLoadState as useTasksLoad, type Task } from "@/lib/tasks";
import { useNotes, useLoadState as useNotesLoad } from "@/lib/notes";
import { usePins, useLoadState as usePinsLoad } from "@/lib/pins";
import { useShifts, SHIFT_KIND_LABELS, useLoadState as useShiftsLoad, type Shift } from "@/lib/shifts";
import { useContacts, useLoadState as useContactsLoad } from "@/lib/contacts";
import { useReports, summarize, useLoadState as useReportsLoad } from "@/lib/canvass";
import { usePhoneContacts, summarizePhoning, useLoadState as usePhoningLoad } from "@/lib/phoning";
import { useCampaign, useSectors, voteGoal, useLoadState as useCampaignLoad } from "@/lib/campaign";
import { memberName, memberInitials, memberRolesOf, type WsContext } from "@/app/espace/types";
import { RoleChips } from "@/components/role-chip";
import { Skeleton } from "@/components/skeleton";
import { ErrorState } from "@/components/error-state";
import { EspaceOnboarding } from "@/app/espace/espace-onboarding";
import type { Tab } from "@/app/espace/espace-view";
import { fmtInt } from "@/lib/format";

const fmtPct = (n: number) => `${Math.round(n * 100)} %`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDue = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : null);

export function EspaceOverview({ ctx, setTab }: { ctx: WsContext; setTab: (t: Tab) => void }) {
  const tasks = useTasks();
  const notes = useNotes();
  const pins = usePins();
  const shifts = useShifts();
  const contacts = useContacts();
  const reports = useReports();
  const campaign = useCampaign();
  const sectors = useSectors();

  // Disponibilité des données (évite le flash d'état vide au chargement).
  // Tous les hooks sont appelés inconditionnellement (pas de court-circuit).
  const loadStates = [
    useTasksLoad(),
    useNotesLoad(),
    usePinsLoad(),
    useShiftsLoad(),
    useContactsLoad(),
    useReportsLoad(),
    usePhoningLoad(),
    useCampaignLoad(),
  ];
  const ready = loadStates.every((s) => s.loaded);
  const anyError = loadStates.some((s) => s.error);

  const goal = voteGoal(campaign);
  const identified = sectors.reduce((s, x) => s + x.favorable, 0);
  const goalProgress = goal && goal > 0 ? Math.min(1, identified / goal) : 0;
  const coveredSectors = sectors.filter((s) => s.status === "done").length;
  const coverage = sectors.length ? coveredSectors / sectors.length : 0;

  const active = tasks.filter((t) => t.status !== "done");
  const today = todayISO();
  const upcoming = useMemo(
    () => active.filter((t) => t.dueDate != null).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1)).slice(0, 5),
    [active],
  );
  const upcomingShifts = useMemo(() => shifts.filter((s) => s.date >= today).slice(0, 5), [shifts, today]);
  const phoneContacts = usePhoneContacts();
  const summary = useMemo(() => summarize(reports), [reports]);
  // Sondage terrain global = porte-à-porte + phoning fusionnés.
  const field = useMemo(() => {
    const ph = summarizePhoning(phoneContacts);
    const favorable = summary.favorable + ph.favorable;
    const neutral = summary.neutral + ph.neutre;
    const unfavorable = summary.unfavorable + ph.defavorable;
    const opinions = favorable + neutral + unfavorable;
    return {
      contacted: summary.met + ph.reached,
      favorable,
      neutral,
      unfavorable,
      opinions,
      favPct: opinions ? favorable / opinions : 0,
      neuPct: opinions ? neutral / opinions : 0,
      unfPct: opinions ? unfavorable / opinions : 0,
    };
  }, [summary, phoneContacts]);
  const benevoles = contacts.filter((c) => c.kind === "benevole").length;

  if (anyError)
    return <ErrorState message="Impossible de charger le tableau de bord." onRetry={() => loadStates.forEach((s) => s.retry())} />;
  if (!ready) return <OverviewSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <EspaceOnboarding ctx={ctx} campaign={campaign} sectors={sectors} goal={goal} setTab={setTab} />

      {/* Objectif de campagne */}
      {goal != null && (
        <button
          type="button"
          onClick={() => setTab("campaign")}
          className="flex flex-col gap-2 rounded-lg border border-warm/30 bg-warm/[0.06] p-4 text-left shadow-card transition-colors hover:bg-warm/[0.1]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-warm">
              <Target className="h-3.5 w-3.5" /> Objectif de campagne
              {campaign?.target && <span className="font-medium normal-case text-foreground/70">· {campaign.target.label}</span>}
            </span>
            <span className="text-[12px] font-semibold tabular-nums">
              {fmtInt(identified)} / {fmtInt(goal)} voix
              {sectors.length > 0 && <span className="ml-2 font-normal text-muted-foreground">· {fmtPct(coverage)} couvert</span>}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-soft/70">
            <span className="block h-full rounded-pill bg-warm transition-all" style={{ width: `${goalProgress * 100}%` }} />
          </div>
        </button>
      )}

      {/* Stats — un par module */}
      <div className="anim-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={ListTodo} label="Actions en cours" value={active.length} onClick={() => setTab("tasks")} accent />
        <Stat icon={CalendarClock} label="Permanences à venir" value={upcomingShifts.length} onClick={() => setTab("shifts")} />
        <Stat icon={DoorOpen} label="Personnes contactées" value={field.contacted} onClick={() => setTab("canvass")} />
        <Stat icon={Contact} label="Contacts" value={contacts.length} onClick={() => setTab("contacts")} />
        <Stat icon={StickyNote} label="Notes" value={notes.length} onClick={() => setTab("notes")} />
        <Stat icon={Star} label="Épingles" value={pins.length} onClick={() => setTab("pins")} />
      </div>

      {/* Sondage terrain (porte-à-porte + phoning) */}
      {field.opinions > 0 && (
        <button
          type="button"
          onClick={() => setTab("canvass")}
          className="rounded-lg border border-foreground/5 bg-surface p-4 text-left shadow-card transition-colors hover:border-warm/30"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <DoorOpen className="h-3.5 w-3.5" /> Sondage terrain
            </span>
            <span className="text-[12px]">
              <span className="font-semibold text-emerald-600">{fmtPct(field.favPct)}</span>
              <span className="text-muted-foreground"> favorables · {fmtInt(field.opinions)} contacts</span>
            </span>
          </div>
          <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-pill">
            <span className="bg-emerald-500" style={{ width: `${field.favPct * 100}%` }} />
            <span className="bg-slate-400" style={{ width: `${field.neuPct * 100}%` }} />
            <span className="bg-red-500" style={{ width: `${field.unfPct * 100}%` }} />
          </div>
        </button>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Échéances proches */}
        <Panel title="Échéances proches" icon={CalendarClock} onSeeAll={() => setTab("tasks")}>
          {upcoming.length === 0 ? (
            <Empty>Aucune échéance planifiée.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {upcoming.map((t) => (
                <TaskLine key={t.id} task={t} ctx={ctx} />
              ))}
            </ul>
          )}
        </Panel>

        {/* Prochaines permanences */}
        <Panel title="Prochaines permanences" icon={Clock} onSeeAll={() => setTab("shifts")}>
          {upcomingShifts.length === 0 ? (
            <Empty>Aucune permanence planifiée.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {upcomingShifts.map((s) => (
                <ShiftLine key={s.id} shift={s} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Notes récentes */}
      <Panel title="Notes récentes" icon={StickyNote} onSeeAll={() => setTab("notes")}>
        {notes.length === 0 ? (
          <Empty>Aucune note de terrain pour l’instant.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {notes.slice(0, 4).map((n) => (
              <li key={n.id} className="rounded-lg border border-foreground/5 bg-canvas/40 p-3">
                {n.title && <p className="truncate text-[13px] font-medium">{n.title}</p>}
                <p className="line-clamp-2 text-[12px] text-muted-foreground">{n.body}</p>
                {n.context && (
                  <Link href={n.context.href} className="mt-1 inline-flex items-center gap-1 text-[11px] text-warm hover:underline">
                    <MapPin className="h-3 w-3" /> {n.context.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Qui fait quoi — équipe & rôles */}
      {ctx.teamId && ctx.members.length > 0 && (
        <section className="rounded-lg border border-foreground/5 bg-surface p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <Users2 className="h-3.5 w-3.5" /> Qui fait quoi
            </h2>
            <Link href="/auth/team" className="inline-flex items-center gap-1 text-[11.5px] font-medium text-warm hover:underline">
              Gérer les rôles <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-border/60">
            {ctx.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2 text-[12.5px]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-surface-soft text-[9px] font-semibold text-foreground/70">
                  {memberInitials(m.name)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {m.name}
                  {m.id === ctx.meId && <span className="text-muted-foreground"> (moi)</span>}
                </span>
                {m.roles.length > 0 ? (
                  <RoleChips roles={m.roles} max={4} />
                ) : (
                  <span className="text-[11px] text-muted-foreground">Aucun rôle</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {benevoles > 0 && (
        <p className="text-center text-[11px] text-muted-foreground">
          {benevoles} bénévole{benevoles > 1 ? "s" : ""} dans le carnet de contacts · {sectors.length} secteurs au plan de terrain
        </p>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-[68px] w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  onClick,
  accent,
}: {
  icon: typeof ListTodo;
  label: string;
  value: number | string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-4 text-left shadow-card transition-colors",
        accent ? "border-warm/30 bg-warm/[0.06] hover:bg-warm/[0.1]" : "border-foreground/5 bg-surface hover:border-warm/30",
      )}
    >
      <Icon className={cn("h-4 w-4", accent ? "text-warm" : "text-muted-foreground")} />
      <span className="mt-1 text-[24px] font-semibold tabular-nums leading-none tracking-tight">{value}</span>
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
    </button>
  );
}

function Panel({
  title,
  icon: Icon,
  onSeeAll,
  children,
}: {
  title: string;
  icon: typeof ListTodo;
  onSeeAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-foreground/5 bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {title}
        </h2>
        <button type="button" onClick={onSeeAll} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-warm hover:underline">
          Tout voir <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {children}
    </section>
  );
}

function TaskLine({ task, ctx }: { task: Task; ctx: WsContext }) {
  const overdue = task.dueDate != null && task.dueDate < todayISO();
  return (
    <li className="flex items-center gap-2 py-2 text-[12.5px]">
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{TASK_KIND_LABELS[task.kind]}</span>
      {task.assignee && (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          · {memberName(ctx.members, task.assignee)}
          <RoleChips roles={memberRolesOf(ctx.members, task.assignee)} max={1} />
        </span>
      )}
      {task.dueDate && (
        <span className={cn("shrink-0 text-[11px]", overdue ? "font-semibold text-red-600" : "text-muted-foreground")}>
          {fmtDue(task.dueDate)}
        </span>
      )}
    </li>
  );
}

function ShiftLine({ shift }: { shift: Shift }) {
  const time = fmtTime(shift.startTime);
  const count = shift.signups.length;
  return (
    <li className="flex items-center gap-2 py-2 text-[12.5px]">
      <span className="min-w-0 flex-1 truncate">{shift.title}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{SHIFT_KIND_LABELS[shift.kind]}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">· {count}{shift.capacity != null ? `/${shift.capacity}` : ""}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDue(shift.date)}{time ? ` ${time}` : ""}</span>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-4 text-[12.5px] text-muted-foreground">{children}</p>;
}
