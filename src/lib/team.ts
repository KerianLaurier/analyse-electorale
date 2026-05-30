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
