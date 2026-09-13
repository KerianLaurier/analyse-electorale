// Espace de travail : rôles & grille tarifaire (référence).
// Le compte, l'abonnement et l'essai réels sont chargés depuis Supabase
// (table `profiles`) côté page serveur ; voir src/app/auth/team/page.tsx.
// Le partage d'équipe (membres, invitations) et la facturation Stripe restent
// à brancher dans un sprint dédié.

import type { Cycle, Tier } from "@/lib/billing";

export type Role = "owner" | "admin" | "member";

export type PlanId = "solo" | "equipe" | "cabinet";

export type Plan = {
  id: PlanId;
  /** Valeur `profiles.subscription_tier` correspondante en base. */
  tier: Tier;
  name: string;
  /**
   * Prix affichés ET facturés — tenus en phase avec la grille figée côté SQL
   * (`billing_price_eur`, supabase/migrations/20260708_self_service_billing.sql).
   * `null` = sur devis (pas de self-service).
   */
  monthly: number | null;
  yearly: number | null;
  price: string;
  period: string;
  seats: string;
  tagline: string;
  features: string[];
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};

export const PLANS: Plan[] = [
  {
    id: "solo",
    tier: "candidat",
    name: "Solo",
    monthly: 49,
    yearly: 490,
    price: "49 €",
    period: "/ mois",
    seats: "1 siège",
    tagline: "Pour un analyste indépendant.",
    features: [
      "Explorer (toutes mailles)",
      "Analyser (diagnostic, tendances)",
      "Historique des scrutins",
    ],
  },
  {
    id: "equipe",
    tier: "equipe",
    name: "Équipe",
    monthly: 199,
    yearly: 1990,
    price: "199 €",
    period: "/ mois",
    seats: "5 sièges",
    tagline: "Pour une équipe de campagne.",
    features: [
      "Tout Solo",
      "Analyser (swing, corrélations)",
      "Simulateur & marginalité",
      "Exports (à venir)",
      "Support prioritaire",
    ],
  },
  {
    id: "cabinet",
    tier: "parti",
    name: "Cabinet",
    monthly: null,
    yearly: null,
    price: "Sur devis",
    period: "",
    seats: "Sièges illimités",
    tagline: "Pour un cabinet ou un parti.",
    features: [
      "Tout Équipe",
      "SSO & rôles avancés (sur étude)",
      "Accès API (sur étude)",
      "Données sur-mesure",
      "Accompagnement dédié",
    ],
  },
];

/** Formule correspondant à un tier DB (repli : Solo). */
export function planForTier(tier: string | null): Plan {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

/** Prix d'une formule pour un cycle, ou null si sur devis. */
export function planPrice(plan: Plan, cycle: Cycle): number | null {
  return cycle === "yearly" ? plan.yearly : plan.monthly;
}

export function initials(name: string, email: string): string {
  const base = name && name !== "—" ? name : email;
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Rôle de campagne personnalisé (défini par le propriétaire de l'équipe). */
export type TeamRole = { id: string; name: string; color: string };

/** Suggestions prêtes à l'emploi pour une équipe de campagne. */
export const ROLE_SUGGESTIONS: { name: string; color: string }[] = [
  { name: "Logistique", color: "#f59e0b" },
  { name: "Communication", color: "#3b82f6" },
  { name: "Trésorier", color: "#16a34a" },
  { name: "Responsable terrain", color: "#dc2626" },
  { name: "Mobilisation", color: "#8b5cf6" },
  { name: "Porte-parole", color: "#ec4899" },
  { name: "Data / analyse", color: "#0ea5e9" },
];

/** Palette de couleurs proposée pour un rôle. */
export const ROLE_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#16a34a",
  "#dc2626",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
  "#64748b",
];
