// Espace de travail : équipe & abonnement.
//
// ⚠️ Données de préversion (mock). Le branchement Supabase se fera ici :
//   - `members` ← supabase.from('team_members').select('*, profile(*)')
//   - `subscription` ← supabase.from('subscriptions').select().single()
//   - mutations (invite / role / remove / billing) → Edge Functions + Stripe.
// Les types ci-dessous sont calqués sur le schéma cible pour limiter le
// refactor au moment du câblage.

export type Role = "owner" | "admin" | "member";
export type MemberStatus = "active" | "invited";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  lastActive: string | null; // ISO ou null si invité
};

export type PlanId = "solo" | "equipe" | "cabinet";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  seats: string;
  tagline: string;
  features: string[];
};

export type Subscription = {
  planId: PlanId;
  status: "active" | "trialing" | "past_due";
  renewsAt: string; // ISO
  seatsUsed: number;
  seatsTotal: number;
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};

export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    price: "49 €",
    period: "/ mois",
    seats: "1 siège",
    tagline: "Pour un analyste indépendant.",
    features: ["Explorer (toutes mailles)", "Suivre (sondages, agenda)", "Historique des scrutins"],
  },
  {
    id: "equipe",
    name: "Équipe",
    price: "199 €",
    period: "/ mois",
    seats: "5 sièges",
    tagline: "Pour une équipe de campagne.",
    features: ["Tout Solo", "Analyser (swing, corrélations)", "Simulateur & marginalité", "Exports (à venir)", "Support prioritaire"],
  },
  {
    id: "cabinet",
    name: "Cabinet",
    price: "Sur devis",
    period: "",
    seats: "Sièges illimités",
    tagline: "Pour un cabinet ou un parti.",
    features: ["Tout Équipe", "SSO & rôles avancés", "Accès API", "Données sur-mesure", "Accompagnement dédié"],
  },
];

// ── Mock de préversion ────────────────────────────────────────────────────────

export const MOCK_SUBSCRIPTION: Subscription = {
  planId: "equipe",
  status: "active",
  renewsAt: "2026-06-28",
  seatsUsed: 3,
  seatsTotal: 5,
};

export const MOCK_MEMBERS: TeamMember[] = [
  { id: "u1", name: "Kérian Laurier", email: "kerian@mouvancia.app", role: "owner", status: "active", lastActive: "2026-05-29T08:10:00Z" },
  { id: "u2", name: "Camille Dubois", email: "camille@mouvancia.app", role: "admin", status: "active", lastActive: "2026-05-28T17:42:00Z" },
  { id: "u3", name: "Hugo Marchand", email: "hugo@mouvancia.app", role: "member", status: "active", lastActive: "2026-05-27T11:05:00Z" },
  { id: "u4", name: "—", email: "nina@parti.fr", role: "member", status: "invited", lastActive: null },
];

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function initials(name: string, email: string): string {
  const base = name && name !== "—" ? name : email;
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
