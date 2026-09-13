"use client";

import { useHydrated } from "@/lib/use-hydrated";
import { createClient } from "@/lib/supabase/client";
import { getIdentity } from "@/lib/identity";
import {
  getPrivateQueryClient as getQueryClient,
  usePrivateQuery as useQuery,
} from "@/lib/private-query";
import { toast } from "@/components/toaster";

/**
 * Carnet de contacts de campagne (bénévoles, soutiens, presse, élus…) —
 * persistés côté serveur (table `contacts`). Personnels ou partagés avec
 * l'équipe (visibles & modifiables par tous les membres via RLS).
 *
 * Adossé à TanStack Query (cf. migration des stores, pilote `pins`). API publique
 * inchangée ; mutations optimistes via le cache, rollback + toast d'erreur.
 */

export type ContactKind =
  | "benevole"
  | "soutien"
  | "electeur"
  | "presse"
  | "elu"
  | "partenaire"
  | "autre";
export type ContactSupport = "favorable" | "indecis" | "oppose" | "inconnu";
export type ContactContext = {
  type: string;
  id: string;
  label: string;
  href: string;
};

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

const CONTACTS_KEY = ["contacts"] as const;
const EMPTY: Contact[] = [];

const contactsQuery = {
  queryKey: CONTACTS_KEY,
  queryFn: fetchContacts,
  staleTime: 5 * 60 * 1000,
};

function mapRow(r: Row, myUserId: string | null): Contact {
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
    context:
      r.context_type && r.context_id
        ? {
            type: r.context_type,
            id: r.context_id,
            label: r.context_label ?? r.context_id,
            href: r.context_href ?? "#",
          }
        : null,
    teamId: r.team_id,
    shared: r.team_id != null,
    mine: r.user_id === myUserId,
    createdAt: new Date(r.created_at).getTime(),
  };
}

async function fetchContacts(): Promise<Contact[]> {
  const { userId } = await getIdentity();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error; // remonte l'échec de lecture → état d'erreur
  return (data ?? []).map((r) => mapRow(r as Row, userId));
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

/** Ajoute un contact. Renvoie false en cas d'échec (le formulaire reste rempli). */
export async function addContact(input: NewContact): Promise<boolean> {
  const { userId, teamId } = await getIdentity();
  const privateClient = getQueryClient();
  if (!userId) return false;
  const supabase = createClient();
  const team_id = input.shared && teamId ? teamId : null;
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
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
  if (error || !data) {
    toast.error(
      "Impossible d'ajouter le contact — vérifiez votre connexion puis réessayez.",
    );
    return false;
  }
  privateClient.setQueryData<Contact[]>(CONTACTS_KEY, (old) => [
    mapRow(data as Row, userId),
    ...(old ?? []),
  ]);
  return true;
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

export async function updateContact(
  id: string,
  patch: ContactPatch,
): Promise<void> {
  const { teamId } = await getIdentity();
  const privateClient = getQueryClient();
  const qc = privateClient;
  const current = qc.getQueryData<Contact[]>(CONTACTS_KEY) ?? [];
  const idx = current.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const next: Contact = { ...current[idx] };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.role !== undefined) next.role = patch.role;
  if (patch.phone !== undefined) next.phone = patch.phone;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.support !== undefined) next.support = patch.support;
  if (patch.locality !== undefined) next.locality = patch.locality;
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.shared !== undefined) {
    next.teamId = patch.shared && teamId ? teamId : null;
    next.shared = next.teamId != null;
  }
  qc.setQueryData<Contact[]>(CONTACTS_KEY, [
    ...current.slice(0, idx),
    next,
    ...current.slice(idx + 1),
  ]);

  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const k of [
    "name",
    "kind",
    "role",
    "phone",
    "email",
    "support",
    "locality",
    "notes",
  ] as const) {
    if (patch[k] !== undefined) dbPatch[k] = patch[k];
  }
  if (patch.shared !== undefined)
    dbPatch.team_id = patch.shared && teamId ? teamId : null;

  const supabase = createClient();
  const { error } = await supabase
    .from("contacts")
    .update(dbPatch)
    .eq("id", id);
  if (error) {
    await qc.invalidateQueries({ queryKey: CONTACTS_KEY }); // rollback : on recharge l'état serveur
    toast.error("Modification non enregistrée — réessayez.");
  }
}

export async function deleteContact(id: string): Promise<void> {
  const privateClient = getQueryClient();
  const qc = privateClient;
  qc.setQueryData<Contact[]>(CONTACTS_KEY, (old) =>
    (old ?? []).filter((c) => c.id !== id),
  );
  const supabase = createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) {
    await qc.invalidateQueries({ queryKey: CONTACTS_KEY }); // rollback : le contact réapparaît
    toast.error("Suppression impossible — réessayez.");
  }
}

function useContactsQuery() {
  return useQuery(contactsQuery);
}

export function useContacts(): Contact[] {
  return useContactsQuery().data ?? EMPTY;
}

/** État de chargement d'un onglet : `loaded` (après hydratation), `error`, `retry`. */
export function useLoadState() {
  const q = useContactsQuery();
  const hydrated = useHydrated();
  return {
    loaded: q.isSuccess && hydrated,
    error: q.isError,
    retry: () => {
      void q.refetch();
    },
  };
}

/** True une fois le premier chargement terminé (pour les squelettes). */
export function useLoaded(): boolean {
  return useLoadState().loaded;
}
