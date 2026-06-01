// Espace de travail : rôles & grille tarifaire (référence).
// Le compte, l'abonnement et l'essai réels sont chargés depuis Supabase
// (table `profiles`) côté page serveur ; voir src/app/auth/team/page.tsx.
// Le partage d'équipe (membres, invitations) et la facturation Stripe restent
// à brancher dans un sprint dédié.

export type Role = "owner" | "admin" | "member";

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
  "#f59e0b", "#3b82f6", "#16a34a", "#dc2626", "#8b5cf6", "#ec4899", "#0ea5e9", "#64748b",
];
