"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, Circle, CircleDot, MoreHorizontal, Trash2, Users, User, CalendarClock, MapPin } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { Input } from "@appica/ui-react/input";
import { Checkbox } from "@appica/ui-react/checkbox";
import { Spinner } from "@appica/ui-react/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@appica/ui-react/select";
import { cn } from "@/lib/utils";
import {
  useTasks,
  useLoadState,
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
  DropdownMenuGroupLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@appica/ui-react/dropdown-menu";
import { ContextSelect, type CtxValue } from "@/app/espace/context-select";
import { memberName, memberInitials, memberRolesOf, type WsContext } from "@/app/espace/types";
import { RoleChips } from "@/components/role-chip";
import { TabSkeleton } from "@/components/skeleton";
import { ErrorState } from "@/components/error-state";

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
  const { loaded, error, retry } = useLoadState();
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [showForm, setShowForm] = useState(false);

  if (error) return <ErrorState message="Impossible de charger les actions." onRetry={retry} />;
  if (!loaded) return <TabSkeleton />;

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
        <Button
          type="button"
          variant={onlyMine ? "light" : "soft"}
          size="sm"
          aria-pressed={onlyMine}
          onClick={() => setOnlyMine((v) => !v)}
          className={cn("ml-auto gap-1.5 rounded-pill text-[12px]", onlyMine && "bg-warm/15 text-foreground")}
        >
          <User className="h-3.5 w-3.5" /> Mes actions
        </Button>
        <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5 rounded-pill text-[12px]">
          <Plus className="h-3.5 w-3.5" /> Nouvelle action
        </Button>
      </div>

      <p className="-mt-2 text-[11.5px] text-muted-foreground">
        Tâches d’organisation (communication, logistique, démarches…). Le terrain collectif se planifie dans Permanences.
      </p>

      {showForm && <TaskForm ctx={ctx} onDone={() => setShowForm(false)} />}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-4 py-10 text-center text-[13px] text-muted-foreground">
          Aucune action {filter !== "all" ? `« ${TASK_STATUS_LABELS[filter as TaskStatus]} »` : ""}. Les actions sont les
          tâches d’organisation (communication, logistique, démarches…). Les sessions de terrain
          collectives (porte-à-porte, tractage…) se planifient dans l’onglet Permanences.
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
    <Button
      type="button"
      variant={active ? "primary" : "soft"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      className="rounded-pill text-[12px]"
    >
      {children}
    </Button>
  );
}

function TaskForm({ ctx, onDone }: { ctx: WsContext; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("communication");
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
    const ok = await addTask({
      title: title.trim(),
      kind,
      priority,
      dueDate: dueDate || null,
      assignee: assignee || null,
      shared: shared && !!ctx.teamId,
      context,
    });
    setBusy(false);
    // En cas d'échec (toast affiché par le store), le formulaire reste rempli.
    if (ok) onDone();
  }

  // Les contrôles Appica portent leur propre cadre : il ne reste que l'échelle.
  const field = "text-[13px]";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Que faut-il faire ? (ex. Imprimer 5 000 tracts, déposer le dossier de candidature)"
        className="text-[14px]"
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Type</span>
          <Select value={kind} onValueChange={(v) => setKind(v as TaskKind)} size="sm">
            <SelectTrigger className={field}><SelectValue /></SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>{TASK_KIND_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Priorité</span>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)} size="sm">
            <SelectTrigger className={field}><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["high", "med", "low"] as TaskPriority[]).map((pr) => (
                <SelectItem key={pr} value={pr}>{TASK_PRIORITY_LABELS[pr]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Échéance</span>
          <Input type="date" value={dueDate} min={todayISO()} onChange={(e) => setDueDate(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Assignée à</span>
          <Select value={assignee} onValueChange={(v) => setAssignee(String(v ?? ""))} size="sm">
            <SelectTrigger className={field}><SelectValue placeholder="Personne" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Personne</SelectItem>
              {ctx.members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.id === ctx.meId ? `${m.name} (moi)` : m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ContextSelect value={context} onChange={setContext} className={cn(field, "min-w-[220px] flex-1")} />
        {ctx.teamId && (
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/80">
            <Checkbox checked={shared} onCheckedChange={setShared} />
            <Users className="h-3.5 w-3.5" /> Partagée avec l’équipe
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone} className="rounded-pill text-[12.5px]">
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={!title.trim() || busy} className="gap-1.5 rounded-pill text-[12.5px]">
            {busy && <Spinner currentColor className="size-3.5" aria-label="Ajout en cours" />} Ajouter
          </Button>
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
    <div className={cn("flex items-start gap-3 rounded-lg border border-foreground/5 bg-surface p-3.5 shadow-card", done && "opacity-70")}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={done ? "Marquer à faire" : "Marquer comme fait"}
        aria-pressed={done}
        onClick={() => updateTask(task.id, { status: done ? "todo" : "done" })}
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border p-0",
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-transparent hover:border-warm",
        )}
      >
        <Check className="h-3 w-3" />
      </Button>

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
              <RoleChips roles={memberRolesOf(ctx.members, task.assignee)} max={2} className="ml-0.5" />
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
          <DropdownMenuRadioGroup value={task.status} onValueChange={(v) => void updateTask(task.id, { status: v as TaskStatus })}>
            <DropdownMenuGroupLabel>Statut</DropdownMenuGroupLabel>
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
              <DropdownMenuItem onClick={() => void deleteTask(task.id)} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4" /> Supprimer
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
