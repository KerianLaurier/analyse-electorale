"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Carnet de contacts de campagne (bénévoles, soutiens, presse, élus…) —
 * persistés côté serveur (table `contacts`). Personnels ou partagés avec
 * l'équipe (visibles & modifiables par tous les membres via RLS).
 */

export type ContactKind = "benevole" | "soutien" | "electeur" | "presse" | "elu" | "partenaire" | "autre";
export type ContactSupport = "favorable" | "indecis" | "oppose" | "inconnu";
export type ContactContext = { type: string; id: string; label: string; href: string };

export type Contact = {
  id: string;
  authorId: string;
  name: string;
  kind: ContactKind;
  role: string | null;
  phone: string | null;
  email: string | null;
  support: ContactSupport;
  locality: string | null;
  notes: string | null;
  context: ContactContext | null;
  teamId: string | null;
  shared: boolean;
  mine: boolean;
  createdAt: number;
};

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  benevole: "Bénévole",
  soutien: "Soutien",
  electeur: "Électeur",
  presse: "Presse",
  elu: "Élu / institution",
  partenaire: "Partenaire",
  autre: "Autre",
};

export const CONTACT_SUPPORT_LABELS: Record<ContactSupport, string> = {
  favorable: "Favorable",
  indecis: "Indécis",
  oppose: "Opposé",
  inconnu: "Inconnu",
};

type Row = {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  kind: ContactKind;
  role: string | null;
  phone: string | null;
  email: string | null;
  support: ContactSupport;
  locality: string | null;
  notes: string | null;
  context_type: string | null;
  context_id: string | null;
  context_label: string | null;
  context_href: string | null;
  created_at: string;
};

let myUserId: string | null = null;
let myTeamId: string | null = null;
let contacts: Contact[] = [];
let loadStarted = false;
const listeners = new Set<() => void>();
const EMPTY: Contact[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function mapRow(r: Row): Contact {
  return {
    id: r.id,
    authorId: r.user_id,
    name: r.name,
    kind: r.kind,
    role: r.role,
    phone: r.phone,
    email: r.email,
    support: r.support,
    locality: r.locality,
    notes: r.notes,
    context: r.context_type && r.context_id
      ? { type: r.context_type, id: r.context_id, label: r.context_label ?? r.context_id, href: r.context_href ?? "#" }
      : null,
    teamId: r.team_id,
    shared: r.team_id != null,
    mine: r.user_id === myUserId,
    createdAt: new Date(r.created_at).getTime(),
  };
}

async function load() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  myUserId = user?.id ?? null;
  if (!user) {
    myTeamId = null;
    contacts = [];
    emit();
    return;
  }
  const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", user.id).single();
  myTeamId = (prof?.team_id as string | null) ?? null;
  const { data } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
  contacts = (data ?? []).map((r) => mapRow(r as Row));
  emit();
}

function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void load();
  createClient().auth.onAuthStateChange(() => void load());
}

export type NewContact = {
  name: string;
  kind?: ContactKind;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  support?: ContactSupport;
  locality?: string | null;
  notes?: string | null;
  shared?: boolean;
  context?: ContactContext | null;
};

export async function addContact(input: NewContact): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  myUserId = user.id;
  const team_id = input.shared && myTeamId ? myTeamId : null;
  const { data } = await supabase
    .from("contacts")
    .insert({
      user_id: user.id,
      team_id,
      name: input.name,
      kind: input.kind ?? "soutien",
      role: input.role ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      support: input.support ?? "inconnu",
      locality: input.locality ?? null,
      notes: input.notes ?? null,
      context_type: input.context?.type ?? null,
      context_id: input.context?.id ?? null,
      context_label: input.context?.label ?? null,
      context_href: input.context?.href ?? null,
    })
    .select("*")
    .single();
  if (data) {
    contacts = [mapRow(data as Row), ...contacts];
    emit();
  }
}

export type ContactPatch = {
  name?: string;
  kind?: ContactKind;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  support?: ContactSupport;
  locality?: string | null;
  notes?: string | null;
  shared?: boolean;
};

export async function updateContact(id: string, patch: ContactPatch): Promise<void> {
  const idx = contacts.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const next: Contact = { ...contacts[idx] };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.role !== undefined) next.role = patch.role;
  if (patch.phone !== undefined) next.phone = patch.phone;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.support !== undefined) next.support = patch.support;
  if (patch.locality !== undefined) next.locality = patch.locality;
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.shared !== undefined) {
    next.teamId = patch.shared && myTeamId ? myTeamId : null;
    next.shared = next.teamId != null;
  }
  contacts = [...contacts.slice(0, idx), next, ...contacts.slice(idx + 1)];
  emit();

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["name", "kind", "role", "phone", "email", "support", "locality", "notes"] as const) {
    if (patch[k] !== undefined) dbPatch[k] = patch[k];
  }
  if (patch.shared !== undefined) dbPatch.team_id = patch.shared && myTeamId ? myTeamId : null;

  const supabase = createClient();
  const { error } = await supabase.from("contacts").update(dbPatch).eq("id", id);
  if (error) await load();
}

export async function deleteContact(id: string): Promise<void> {
  contacts = contacts.filter((c) => c.id !== id);
  emit();
  const supabase = createClient();
  await supabase.from("contacts").delete().eq("id", id);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  ensureLoaded();
  return () => {
    listeners.delete(l);
  };
}

export function useContacts(): Contact[] {
  return useSyncExternalStore(subscribe, () => contacts, () => EMPTY);
}
