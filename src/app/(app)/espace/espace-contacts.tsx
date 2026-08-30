"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Phone, Mail, MapPin, Pencil, Trash2, Users, Contact as ContactIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@appica/ui-react/select";
import { Checkbox } from "@appica/ui-react/checkbox";
import { Textarea } from "@appica/ui-react/textarea";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import {
  useContacts,
  useLoadState,
  addContact,
  updateContact,
  deleteContact,
  CONTACT_KIND_LABELS,
  CONTACT_SUPPORT_LABELS,
  type Contact,
  type ContactKind,
  type ContactSupport,
} from "@/lib/contacts";
import { ContextSelect, type CtxValue } from "@/app/(app)/espace/context-select";
import type { WsContext } from "@/app/(app)/espace/types";
import { TabSkeleton } from "@/components/skeleton";
import { ErrorState } from "@/components/error-state";

const KINDS = Object.keys(CONTACT_KIND_LABELS) as ContactKind[];
const SUPPORTS = Object.keys(CONTACT_SUPPORT_LABELS) as ContactSupport[];

const SUPPORT_CLASS: Record<ContactSupport, string> = {
  favorable: "bg-emerald-100 text-emerald-700",
  indecis: "bg-amber-100 text-amber-700",
  oppose: "bg-red-100 text-red-700",
  inconnu: "bg-surface-soft text-muted-foreground",
};

const field =
  "text-[13px]";

export function EspaceContacts({ ctx }: { ctx: WsContext }) {
  const contacts = useContacts();
  const { loaded, error, retry } = useLoadState();
  const [kindFilter, setKindFilter] = useState<ContactKind | "all">("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  if (error) return <ErrorState message="Impossible de charger les contacts." onRetry={retry} />;
  if (!loaded) return <TabSkeleton />;

  const q = query.trim().toLowerCase();
  const visible = contacts.filter((c) => {
    if (kindFilter !== "all" && c.kind !== kindFilter) return false;
    if (q && !(`${c.name} ${c.role ?? ""} ${c.locality ?? ""}`.toLowerCase().includes(q))) return false;
    return true;
  });

  const benevoles = contacts.filter((c) => c.kind === "benevole").length;
  const favorables = contacts.filter((c) => c.support === "favorable").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
          Tous · {contacts.length}
        </FilterChip>
        {KINDS.map((k) => {
          const n = contacts.filter((c) => c.kind === k).length;
          if (n === 0 && kindFilter !== k) return null;
          return (
            <FilterChip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
              {CONTACT_KIND_LABELS[k]} · {n}
            </FilterChip>
          );
        })}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className={cn(field, "w-44 pl-8")} />
        </div>
        <Button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="gap-1.5 rounded-pill text-[12px]" size="sm">
          <Plus className="h-3.5 w-3.5" /> Nouveau contact
        </Button>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {contacts.length} contact{contacts.length > 1 ? "s" : ""} · {benevoles} bénévole{benevoles > 1 ? "s" : ""} · {favorables} favorable{favorables > 1 ? "s" : ""}
      </p>

      {showForm && <ContactForm ctx={ctx} onDone={() => setShowForm(false)} />}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-6 py-14 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-pill bg-warm/15 text-warm">
            <ContactIcon className="h-5 w-5" />
          </span>
          <p className="text-[14px] font-semibold">Aucun contact</p>
          <p className="max-w-md text-[12.5px] text-muted-foreground">
            Constituez votre réseau : bénévoles, soutiens, presse locale, élus et partenaires.
            Partagez-le avec l’équipe pour mobiliser le terrain.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((c) => (
            <ContactCard key={c.id} contact={c} ctx={ctx} />
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
      onClick={onClick}
      className={cn(
        "rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.04] text-foreground/80 hover:bg-foreground/[0.08]",
      )} variant="ghost" size="sm">
      {children}
    </Button>
  );
}

function ContactForm({
  ctx,
  initial,
  onDone,
}: {
  ctx: WsContext;
  initial?: Contact;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<ContactKind>(initial?.kind ?? "benevole");
  const [role, setRole] = useState(initial?.role ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [support, setSupport] = useState<ContactSupport>(initial?.support ?? "inconnu");
  const [locality, setLocality] = useState(initial?.locality ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [shared, setShared] = useState<boolean>(initial ? initial.shared : !!ctx.teamId);
  const [context, setContext] = useState<CtxValue>(initial?.context ?? null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      kind,
      role: role.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      support,
      locality: locality.trim() || null,
      notes: notes.trim() || null,
      shared: shared && !!ctx.teamId,
    };
    let ok = true;
    if (initial) await updateContact(initial.id, payload);
    else ok = await addContact({ ...payload, context });
    setBusy(false);
    // En cas d'échec d'ajout (toast affiché par le store), le formulaire reste rempli.
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom *" className={cn(field, "font-medium")} />
        <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Fonction / organisation" className={field} />
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Select value={kind} onValueChange={(appicaValue) => setKind(String(appicaValue ?? "") as ContactKind)} size="sm">
          <SelectTrigger className={field}><SelectValue /></SelectTrigger>
          <SelectContent>
          {KINDS.map((k) => <SelectItem key={k} value={k}>{CONTACT_KIND_LABELS[k]}</SelectItem>)}
        </SelectContent>
        </Select>
        <Select value={support} onValueChange={(appicaValue) => setSupport(String(appicaValue ?? "") as ContactSupport)} size="sm">
          <SelectTrigger className={field}><SelectValue /></SelectTrigger>
          <SelectContent>
          {SUPPORTS.map((s) => <SelectItem key={s} value={s}>{CONTACT_SUPPORT_LABELS[s]}</SelectItem>)}
        </SelectContent>
        </Select>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" className={field} />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={field} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Secteur / quartier / commune" className={field} />
        {!initial && <ContextSelect value={context} onChange={setContext} className={field} />}
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes…" rows={2} className={cn(field, "resize-y")} />
      <div className="flex flex-wrap items-center gap-3">
        {ctx.teamId && (
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/80">
            <Checkbox checked={shared} onCheckedChange={setShared} />
            <Users className="h-3.5 w-3.5" /> Partagé avec l’équipe
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" onClick={onDone} className="rounded-pill text-[12.5px]" variant="ghost" size="sm">
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || busy}
            className="gap-1.5 rounded-pill text-[12.5px]" size="sm">
            {busy && <Spinner currentColor className="size-3.5" />} {initial ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function ContactCard({ contact, ctx }: { contact: Contact; ctx: WsContext }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <ContactForm ctx={ctx} initial={contact} onDone={() => setEditing(false)} />;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-foreground/5 bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{contact.name}</p>
          {contact.role && <p className="truncate text-[12px] text-muted-foreground">{contact.role}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-pill bg-surface-soft px-2 py-0.5 text-[10.5px] font-medium text-foreground/70">
            {CONTACT_KIND_LABELS[contact.kind]}
          </span>
          {contact.shared && <Users className="h-3.5 w-3.5 text-warm" />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <Select value={contact.support} onValueChange={(appicaValue) => updateContact(contact.id, { support: String(appicaValue ?? "") as ContactSupport })} size="sm">
          <SelectTrigger className={cn("rounded-pill border-0 px-2 py-0.5 text-[11px] font-medium outline-none", SUPPORT_CLASS[contact.support])}><SelectValue /></SelectTrigger>
          <SelectContent>
          {SUPPORTS.map((s) => <SelectItem key={s} value={s}>{CONTACT_SUPPORT_LABELS[s]}</SelectItem>)}
        </SelectContent>
        </Select>
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 text-foreground/80 hover:text-warm">
            <Phone className="h-3.5 w-3.5" /> {contact.phone}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-foreground/80 hover:text-warm">
            <Mail className="h-3.5 w-3.5" /> {contact.email}
          </a>
        )}
        {contact.locality && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {contact.locality}
          </span>
        )}
      </div>

      {contact.notes && <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/80">{contact.notes}</p>}

      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        {contact.context && (
          <Link href={contact.context.href} className="inline-flex items-center gap-1 text-warm hover:underline">
            <MapPin className="h-3 w-3" /> {contact.context.label}
          </Link>
        )}
        {contact.mine && (
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" onClick={() => setEditing(true)} aria-label="Modifier" className="h-6 w-6 rounded" variant="soft" size="icon-sm">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" onClick={() => void deleteContact(contact.id)} aria-label="Supprimer" className="h-6 w-6 rounded hover:bg-red-50 hover:text-red-600" variant="ghost" size="icon-sm">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
