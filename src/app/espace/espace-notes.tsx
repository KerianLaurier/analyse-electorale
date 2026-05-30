"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Users, MapPin, Pencil, Trash2, Loader2, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotes, addNote, updateNote, deleteNote, type Note } from "@/lib/notes";
import { ContextSelect, type CtxValue } from "@/app/espace/context-select";
import { memberName, type WsContext } from "@/app/espace/types";

const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export function EspaceNotes({ ctx }: { ctx: WsContext }) {
  const notes = useNotes();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          {notes.length} note{notes.length > 1 ? "s" : ""} de terrain
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Nouvelle note
        </button>
      </div>

      {showForm && <NoteForm ctx={ctx} onDone={() => setShowForm(false)} />}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-black/10 bg-surface/60 px-6 py-14 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-pill bg-warm/15 text-warm">
            <StickyNote className="h-5 w-5" />
          </span>
          <p className="text-[14px] font-semibold">Aucune note</p>
          <p className="max-w-md text-[12.5px] text-muted-foreground">
            Consignez l’intel de terrain : contacts locaux, ressenti, points d’attention par
            territoire. Partagez avec l’équipe pour capitaliser.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}

const fieldCls =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20";

function NoteForm({ ctx, onDone }: { ctx: WsContext; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [shared, setShared] = useState<boolean>(!!ctx.teamId);
  const [context, setContext] = useState<CtxValue>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    await addNote({ title: title.trim() || null, body: body.trim(), shared: shared && !!ctx.teamId, context });
    setBusy(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (optionnel)" className={cn(fieldCls, "font-medium")} />
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Note de terrain…"
        rows={4}
        className={cn(fieldCls, "resize-y")}
      />
      <div className="flex flex-wrap items-center gap-3">
        <ContextSelect value={context} onChange={setContext} className={cn(fieldCls, "min-w-[200px] flex-1")} />
        {ctx.teamId && (
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/80">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="accent-[var(--warm,#c8743c)]" />
            <Users className="h-3.5 w-3.5" /> Partagée
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onDone} className="rounded-pill px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
            Annuler
          </button>
          <button
            type="submit"
            disabled={!body.trim() || busy}
            className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    </form>
  );
}

function NoteCard({ note, ctx }: { note: Note; ctx: WsContext }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.body);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    await updateNote(note.id, { title: title.trim() || null, body: body.trim() });
    setBusy(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-warm/40 bg-surface p-4 shadow-card sm:col-span-1">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className={cn(fieldCls, "font-medium")} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={cn(fieldCls, "resize-y")} />
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="rounded-pill px-3 py-1 text-[12px] text-muted-foreground hover:text-foreground">
            Annuler
          </button>
          <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-3.5 py-1 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {busy && <Loader2 className="h-3 w-3 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/5 bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {note.title && <p className="truncate text-[14px] font-semibold">{note.title}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {note.shared && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-warm/15 px-1.5 py-0.5 text-[10px] font-medium text-warm">
              <Users className="h-3 w-3" /> Équipe
            </span>
          )}
          {note.mine && (
            <>
              <button type="button" onClick={() => setEditing(true)} aria-label="Modifier" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-surface-soft hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => void deleteNote(note.id)} aria-label="Supprimer" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">{note.body}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
        {note.context && (
          <Link href={note.context.href} className="inline-flex items-center gap-1 text-warm hover:underline">
            <MapPin className="h-3 w-3" /> {note.context.label}
          </Link>
        )}
        {note.shared && !note.mine && <span>par {memberName(ctx.members, note.authorId)}</span>}
        <span className="ml-auto">{fmtWhen(note.updatedAt)}</span>
      </div>
    </div>
  );
}
