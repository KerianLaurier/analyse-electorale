"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, Circle, CircleDot, MoreHorizontal, Trash2, Users, User, CalendarClock, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTasks,
  addTask,
  updateTask,
  deleteTask,
  TASK_STATUS_LABELS,
  TASK_KIND_LABELS,
  TASK_PRIORITY_LABELS,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskKind,
} from "@/lib/tasks";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ContextSelect, type CtxValue } from "@/app/espace/context-select";
import { memberName, memberInitials, type WsContext } from "@/app/espace/types";

const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "done"];
const KINDS = Object.keys(TASK_KIND_LABELS) as TaskKind[];

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-red-500",
  med: "bg-amber-500",
  low: "bg-slate-400",
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDue = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export function EspaceTasks({ ctx }: { ctx: WsContext }) {
  const tasks = useTasks();
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const visible = tasks.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (onlyMine && t.assignee !== ctx.meId && !t.mine) return false;
    return true;
  });

  const counts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    doing: tasks.filter((t) => t.status === "doing").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Toutes · {tasks.length}
        </FilterChip>
        {STATUS_ORDER.map((s) => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {TASK_STATUS_LABELS[s]} · {counts[s]}
          </FilterChip>
        ))}
        <button
          type="button"
          onClick={() => setOnlyMine((v) => !v)}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
            onlyMine ? "bg-warm/15 text-foreground" : "bg-black/[0.04] text-foreground/80 hover:bg-black/[0.08]",
          )}
        >
          <User className="h-3.5 w-3.5" /> Mes actions
        </button>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Nouvelle action
        </button>
      </div>

      {showForm && <TaskForm ctx={ctx} onDone={() => setShowForm(false)} />}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/10 bg-surface/60 px-4 py-10 text-center text-[13px] text-muted-foreground">
          Aucune action {filter !== "all" ? `« ${TASK_STATUS_LABELS[filter as TaskStatus]} »` : ""}. Créez la première
          pour organiser le terrain.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((t) => (
            <TaskRow key={t.id} task={t} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-black/[0.04] text-foreground/80 hover:bg-black/[0.08]",
      )}
    >
      {children}
    </button>
  );
}

function TaskForm({ ctx, onDone }: { ctx: WsContext; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("porte");
  const [priority, setPriority] = useState<TaskPriority>("med");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<string>(ctx.meId);
  const [shared, setShared] = useState<boolean>(!!ctx.teamId);
  const [context, setContext] = useState<CtxValue>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    await addTask({
      title: title.trim(),
      kind,
      priority,
      dueDate: dueDate || null,
      assignee: assignee || null,
      shared: shared && !!ctx.teamId,
      context,
    });
    setBusy(false);
    onDone();
  }

  const field = "rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Que faut-il faire ? (ex. Porte-à-porte quartier Gare)"
        className={cn(field, "text-[14px]")}
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)} className={field}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{TASK_KIND_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Priorité</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={field}>
            {(["high", "med", "low"] as TaskPriority[]).map((p) => (
              <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Échéance</span>
          <input type="date" value={dueDate} min={todayISO()} onChange={(e) => setDueDate(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Assignée à</span>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field}>
            <option value="">Personne</option>
            {ctx.members.map((m) => (
              <option key={m.id} value={m.id}>{m.id === ctx.meId ? `${m.name} (moi)` : m.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ContextSelect value={context} onChange={setContext} className={cn(field, "min-w-[220px] flex-1")} />
        {ctx.teamId && (
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/80">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-[var(--warm,#c8743c)]" />
            <Users className="h-3.5 w-3.5" /> Partagée avec l’équipe
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onDone} className="rounded-pill px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
            Annuler
          </button>
          <button
            type="submit"
            disabled={!title.trim() || busy}
            className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Ajouter
          </button>
        </div>
      </div>
    </form>
  );
}

function TaskRow({ task, ctx }: { task: Task; ctx: WsContext }) {
  const overdue = task.dueDate != null && task.status !== "done" && task.dueDate < todayISO();
  const done = task.status === "done";
  const StatusIcon = task.status === "doing" ? CircleDot : done ? Check : Circle;

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-black/5 bg-surface p-3.5 shadow-card", done && "opacity-70")}>
      <button
        type="button"
        aria-label={done ? "Marquer à faire" : "Marquer comme fait"}
        onClick={() => updateTask(task.id, { status: done ? "todo" : "done" })}
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-transparent hover:border-warm",
        )}
      >
        <Check className="h-3 w-3" />
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-[14px] font-medium", done && "line-through text-muted-foreground")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[task.priority])} />
            {TASK_KIND_LABELS[task.kind]}
          </span>
          {!done && (
            <span className="inline-flex items-center gap-1">
              <StatusIcon className="h-3.5 w-3.5" /> {TASK_STATUS_LABELS[task.status]}
            </span>
          )}
          {task.dueDate && (
            <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-red-600")}>
              <CalendarClock className="h-3.5 w-3.5" /> {fmtDue(task.dueDate)}{overdue && " · en retard"}
            </span>
          )}
          {task.assignee && (
            <span className="inline-flex items-center gap-1">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-surface-soft text-[8px] font-semibold text-foreground/70">
                {memberInitials(memberName(ctx.members, task.assignee))}
              </span>
              {memberName(ctx.members, task.assignee)}
            </span>
          )}
          {task.context && (
            <Link href={task.context.href} className="inline-flex items-center gap-1 text-warm hover:underline">
              <MapPin className="h-3.5 w-3.5" /> {task.context.label}
            </Link>
          )}
          {task.shared && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-warm/15 px-1.5 py-0.5 text-[10px] font-medium text-warm">
              <Users className="h-3 w-3" /> Équipe
            </span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Options"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-surface-soft hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Statut</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={task.status} onValueChange={(v) => void updateTask(task.id, { status: v as TaskStatus })}>
            {STATUS_ORDER.map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {ctx.teamId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={task.shared} onCheckedChange={(c) => void updateTask(task.id, { shared: !!c })}>
                Partagée avec l’équipe
              </DropdownMenuCheckboxItem>
            </>
          )}
          {task.mine && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void deleteTask(task.id)} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4" /> Supprimer
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
