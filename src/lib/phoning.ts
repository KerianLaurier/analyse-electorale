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
 * Phoning d'équipe — modèle « listes d'appels + résultat par numéro ».
 * Le·la responsable crée des listes (phone_lists) et y importe des numéros
 * (phone_contacts) ; chaque appelant déroule la file et consigne le résultat
 * détaillé de chaque appel (statut, opinion, notes). Team-scoped via RLS.
 *
 * Adossé à TanStack Query. Les deux collections (listes + numéros) partagent une
 * même entrée de cache. API publique inchangée ; mutations optimistes,
 * rollback + toast d'erreur.
 */

export type CallStatus =
  | "todo"
  | "joint"
  | "repondeur"
  | "occupe"
  | "faux"
  | "refus"
  | "rappeler";
export type CallOpinion = "favorable" | "neutre" | "defavorable";

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  todo: "À appeler",
  joint: "Joint",
  repondeur: "Répondeur",
  occupe: "Occupé",
  faux: "Faux numéro",
  refus: "Refus",
  rappeler: "À rappeler",
};

export const CALL_OPINION_LABELS: Record<CallOpinion, string> = {
  favorable: "Favorable",
  neutre: "Neutre",
  defavorable: "Défavorable",
};

/** Un appel est « traité » si son statut n'est plus « à appeler ». */
export const isHandled = (s: CallStatus) => s !== "todo";

export type PhoneList = {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: number;
};

export type PhoneContact = {
  id: string;
  listId: string;
  name: string | null;
  phone: string;
  status: CallStatus;
  opinion: CallOpinion | null;
  notes: string | null;
  calledBy: string | null;
  calledAt: number | null;
  createdAt: number;
};

type ListRow = {
  id: string;
  team_id: string;
  created_by: string;
  name: string;
  description: string | null;
  created_at: string;
};
type ContactRow = {
  id: string;
  list_id: string;
  team_id: string;
  name: string | null;
  phone: string;
  status: CallStatus;
  opinion: CallOpinion | null;
  notes: string | null;
  called_by: string | null;
  called_at: string | null;
  created_at: string;
};

type PhoningData = { lists: PhoneList[]; contacts: PhoneContact[] };

const PHONING_KEY = ["phoning"] as const;
const EMPTY_LISTS: PhoneList[] = [];
const EMPTY_CONTACTS: PhoneContact[] = [];
const EMPTY_DATA: PhoningData = {
  lists: EMPTY_LISTS,
  contacts: EMPTY_CONTACTS,
};

const phoningQuery = {
  queryKey: PHONING_KEY,
  queryFn: fetchPhoning,
  staleTime: 5 * 60 * 1000,
};

function mapList(r: ListRow): PhoneList {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).getTime(),
  };
}
function mapContact(r: ContactRow): PhoneContact {
  return {
    id: r.id,
    listId: r.list_id,
    name: r.name,
    phone: r.phone,
    status: r.status,
    opinion: r.opinion,
    notes: r.notes,
    calledBy: r.called_by,
    calledAt: r.called_at ? new Date(r.called_at).getTime() : null,
    createdAt: new Date(r.created_at).getTime(),
  };
}

async function fetchPhoning(): Promise<PhoningData> {
  const { userId, teamId } = await getIdentity();
  if (!userId || !teamId) return { lists: [], contacts: [] };
  const supabase = createClient();
  const [{ data: l, error: e1 }, { data: c, error: e2 }] = await Promise.all([
    supabase
      .from("phone_lists")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("phone_contacts")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);
  if (e1 || e2) throw e1 ?? e2; // remonte l'échec de lecture → état d'erreur
  return {
    lists: ((l ?? []) as ListRow[]).map(mapList),
    contacts: ((c ?? []) as ContactRow[]).map(mapContact),
  };
}

function patchData(
  fn: (d: PhoningData) => PhoningData,
  client = getQueryClient(),
) {
  client.setQueryData<PhoningData>(PHONING_KEY, (old) => fn(old ?? EMPTY_DATA));
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function createList(
  name: string,
  description?: string | null,
): Promise<string | null> {
  const { userId, teamId } = await getIdentity();
  const privateClient = getQueryClient();
  if (!userId || !teamId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("phone_lists")
    .insert({
      team_id: teamId,
      created_by: userId,
      name,
      description: description ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    toast.error(
      "Impossible de créer la liste — vérifiez votre connexion puis réessayez.",
    );
    return null;
  }
  patchData(
    (d) => ({ ...d, lists: [mapList(data as ListRow), ...d.lists] }),
    privateClient,
  );
  return (data as ListRow).id;
}

export async function deleteList(id: string): Promise<void> {
  const privateClient = getQueryClient();
  const qc = privateClient;
  patchData(
    (d) => ({
      lists: d.lists.filter((l) => l.id !== id),
      contacts: d.contacts.filter((c) => c.listId !== id),
    }),
    privateClient,
  );
  const supabase = createClient();
  const { error } = await supabase.from("phone_lists").delete().eq("id", id);
  if (error) {
    await qc.invalidateQueries({ queryKey: PHONING_KEY }); // rollback : la liste réapparaît
    toast.error("Suppression impossible — réessayez.");
  }
}

export type NewNumber = { phone: string; name?: string | null };

/** Importe en masse des numéros dans une liste. Renvoie le nombre ajouté. */
export async function addNumbers(
  listId: string,
  items: NewNumber[],
): Promise<number> {
  const { teamId } = await getIdentity();
  const privateClient = getQueryClient();
  if (!teamId || items.length === 0) return 0;
  const supabase = createClient();
  const rows = items.map((it) => ({
    list_id: listId,
    team_id: teamId,
    phone: it.phone,
    name: it.name ?? null,
  }));
  const { data, error } = await supabase
    .from("phone_contacts")
    .insert(rows)
    .select("*");
  if (error) {
    toast.error(
      "Import des numéros impossible — vérifiez votre connexion puis réessayez.",
    );
    return 0;
  }
  const mapped = ((data ?? []) as ContactRow[]).map(mapContact);
  if (mapped.length > 0) {
    patchData(
      (d) => ({ ...d, contacts: [...d.contacts, ...mapped] }),
      privateClient,
    );
  }
  return mapped.length;
}

export type CallPatch = {
  status?: CallStatus;
  opinion?: CallOpinion | null;
  notes?: string | null;
};

/** Consigne le résultat d'un appel sur un numéro. */
export async function logCall(id: string, patch: CallPatch): Promise<void> {
  const { userId } = await getIdentity();
  const privateClient = getQueryClient();
  const qc = privateClient;
  const current = qc.getQueryData<PhoningData>(PHONING_KEY) ?? EMPTY_DATA;
  const idx = current.contacts.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const prev = current.contacts[idx];
  const next: PhoneContact = { ...prev };
  const dbPatch: Record<string, unknown> = {};

  if (patch.status !== undefined) {
    next.status = patch.status;
    dbPatch.status = patch.status;
    // Trace de l'appel dès qu'un résultat est consigné.
    if (isHandled(patch.status)) {
      next.calledBy = userId;
      next.calledAt = Date.now();
      dbPatch.called_by = userId;
      dbPatch.called_at = new Date().toISOString();
    }
    // Un statut sans contact effectif n'a pas d'opinion.
    if (patch.status !== "joint" && patch.opinion === undefined) {
      next.opinion = null;
      dbPatch.opinion = null;
    }
  }
  if (patch.opinion !== undefined) {
    next.opinion = patch.opinion;
    dbPatch.opinion = patch.opinion;
  }
  if (patch.notes !== undefined) {
    next.notes = patch.notes;
    dbPatch.notes = patch.notes;
  }

  patchData(
    (d) => ({
      ...d,
      contacts: [
        ...d.contacts.slice(0, idx),
        next,
        ...d.contacts.slice(idx + 1),
      ],
    }),
    privateClient,
  );

  const supabase = createClient();
  const { error } = await supabase
    .from("phone_contacts")
    .update(dbPatch)
    .eq("id", id);
  if (error) {
    await qc.invalidateQueries({ queryKey: PHONING_KEY }); // rollback : on recharge l'état serveur
    toast.error("Résultat d'appel non enregistré — réessayez.");
  }
}

export async function deleteContact(id: string): Promise<void> {
  const privateClient = getQueryClient();
  const qc = privateClient;
  patchData(
    (d) => ({ ...d, contacts: d.contacts.filter((c) => c.id !== id) }),
    privateClient,
  );
  const supabase = createClient();
  const { error } = await supabase.from("phone_contacts").delete().eq("id", id);
  if (error) {
    await qc.invalidateQueries({ queryKey: PHONING_KEY }); // rollback : le numéro réapparaît
    toast.error("Suppression impossible — réessayez.");
  }
}

// ── Hooks ──────────────────────────────────────────────────────────────────

function usePhoningQuery() {
  return useQuery(phoningQuery);
}

export function usePhoneLists(): PhoneList[] {
  return usePhoningQuery().data?.lists ?? EMPTY_LISTS;
}
export function usePhoneContacts(): PhoneContact[] {
  return usePhoningQuery().data?.contacts ?? EMPTY_CONTACTS;
}

// ── Synthèse ─────────────────────────────────────────────────────────────────

export type PhoningSummary = {
  total: number;
  handled: number;
  reached: number; // joints
  favorable: number;
  neutre: number;
  defavorable: number;
  opinions: number;
  favPct: number;
  neuPct: number;
  defPct: number;
  progress: number; // handled / total
  reachRate: number; // reached / handled
};

export function summarizePhoning(contacts: PhoneContact[]): PhoningSummary {
  let handled = 0,
    reached = 0,
    favorable = 0,
    neutre = 0,
    defavorable = 0;
  for (const c of contacts) {
    if (isHandled(c.status)) handled += 1;
    if (c.status === "joint") reached += 1;
    if (c.opinion === "favorable") favorable += 1;
    else if (c.opinion === "neutre") neutre += 1;
    else if (c.opinion === "defavorable") defavorable += 1;
  }
  const opinions = favorable + neutre + defavorable;
  const total = contacts.length;
  return {
    total,
    handled,
    reached,
    favorable,
    neutre,
    defavorable,
    opinions,
    favPct: opinions > 0 ? favorable / opinions : 0,
    neuPct: opinions > 0 ? neutre / opinions : 0,
    defPct: opinions > 0 ? defavorable / opinions : 0,
    progress: total > 0 ? handled / total : 0,
    reachRate: handled > 0 ? reached / handled : 0,
  };
}

/** État de chargement d'un onglet : `loaded` (après hydratation), `error`, `retry`. */
export function useLoadState() {
  const q = usePhoningQuery();
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
