// Logique pure du parcours d'abonnement (essai → souscription → résiliation).
// Partagée entre le gating (src/proxy.ts), les pages et les tests — aucun I/O.
//
// Le modèle de facturation (« activation immédiate, facture à réception »,
// résiliation effective à l'échéance suivante) est décrit dans
// supabase/migrations/20260708_self_service_billing.sql.

export type SubscriptionStatus = "trial" | "active" | "inactive";
export type Tier = "candidat" | "equipe" | "parti";
export type Cycle = "monthly" | "yearly";

/** Snapshot d'abonnement d'un compte, tel que lu depuis `profiles` (ou les claims JWT). */
export type Subscription = {
  status: SubscriptionStatus;
  tier: Tier;
  trialEndsAt: string | null;
  cancelAt: string | null;
  billingCycle: Cycle | null;
  startedAt: string | null;
};

/**
 * Abonnement valide : actif (sans résiliation échue), ou essai non expiré, ou
 * super-admin. Miroir exact de la règle SQL du gating — c'est LA définition de
 * l'accès à l'application, utilisée par le middleware (claims JWT et repli
 * `profiles`).
 */
export function computeAccess(
  status: string | null,
  trialEndsAt: string | null,
  cancelAt: string | null,
  isSuperAdmin: boolean,
  now: Date = new Date(),
): boolean {
  if (isSuperAdmin) return true;
  if (status === "active") return !cancelAt || new Date(cancelAt) > now;
  if (status === "trial") return !trialEndsAt || new Date(trialEndsAt) > now;
  return false;
}

/** Jours restants (arrondi supérieur, plancher 0), ou null si pas de date. */
export function daysLeft(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Ajoute `n` pas de cycle à une date, en imitant `interval '1 month'/'1 year'`
 * de Postgres : le jour est borné à la fin du mois cible (31 janv + 1 mois =
 * 28/29 févr), et les pas suivants repartent de la date bornée. La cohérence
 * avec `self_cancel()` (boucle SQL additive) prime sur la perfection
 * calendaire.
 */
function addCycle(d: Date, cycle: Cycle): Date {
  const next = new Date(d);
  const day = next.getDate();
  next.setDate(1); // évite le débordement (31 mars + 1 mois ≠ 1er mai)
  next.setMonth(next.getMonth() + (cycle === "yearly" ? 12 : 1));
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, maxDay));
  return next;
}

/**
 * Prochaine échéance par roulement depuis le début d'abonnement — la date à
 * laquelle une résiliation prendrait effet, et la « prochaine facture »
 * affichée au compte. Miroir de la boucle de `self_cancel()`.
 */
export function nextRenewal(
  startedAt: string | null,
  cycle: Cycle | null,
  now: Date = new Date(),
): Date {
  let next = startedAt ? new Date(startedAt) : now;
  if (Number.isNaN(next.getTime())) next = now;
  const step: Cycle = cycle ?? "monthly";
  while (next <= now) next = addCycle(next, step);
  return next;
}

/** Date longue française (ex. « 8 juillet 2026 »). */
export function formatDateFr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Phase du parcours pour l'affichage (bandeau, page abonnement, réglages).
 * - `trialing`   : essai en cours (accès ouvert)
 * - `trial_over` : essai expiré (accès coupé → conversion)
 * - `active`     : abonné, reconduction tacite
 * - `canceling`  : abonné, fin programmée à `cancelAt` (accès ouvert)
 * - `ended`      : abonnement résilié et échu (accès coupé)
 * - `inactive`   : compte désactivé (accès coupé)
 */
export type BillingPhase = "trialing" | "trial_over" | "active" | "canceling" | "ended" | "inactive";

export function billingPhase(
  status: string | null,
  trialEndsAt: string | null,
  cancelAt: string | null,
  now: Date = new Date(),
): BillingPhase {
  if (status === "active") {
    if (!cancelAt) return "active";
    return new Date(cancelAt) > now ? "canceling" : "ended";
  }
  if (status === "trial") {
    return !trialEndsAt || new Date(trialEndsAt) > now ? "trialing" : "trial_over";
  }
  return "inactive";
}
