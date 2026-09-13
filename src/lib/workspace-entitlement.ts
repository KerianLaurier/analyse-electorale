import type { Subscription } from "@/lib/billing";

export type WorkspaceEntitlement = {
  has_access: boolean;
  team_access: boolean;
  covered_by_team: boolean;
  billing_owner_id: string | null;
  team_name: string | null;
  seat_limit: number;
  seats_used: number;
  subscription: Subscription;
};

/** Frontière JSON de la RPC ; un contrat absent ne doit pas accorder un siège. */
export function parseWorkspaceEntitlement(
  value: unknown,
): WorkspaceEntitlement {
  if (!value || typeof value !== "object")
    throw new Error("Droits indisponibles");
  const row = value as Record<string, unknown>;
  const sub = row.subscription as Record<string, unknown> | null;
  const nullableText = (field: unknown) =>
    field === null || typeof field === "string";
  if (
    typeof row.team_access !== "boolean" ||
    typeof row.has_access !== "boolean" ||
    typeof row.covered_by_team !== "boolean" ||
    !nullableText(row.billing_owner_id) ||
    !nullableText(row.team_name) ||
    !Number.isInteger(row.seat_limit) ||
    Number(row.seat_limit) < 0 ||
    !Number.isInteger(row.seats_used) ||
    Number(row.seats_used) < 0 ||
    !sub ||
    !["trial", "active", "inactive"].includes(String(sub.status)) ||
    !["candidat", "equipe", "parti"].includes(String(sub.tier)) ||
    ![null, "monthly", "yearly"].includes(sub.billingCycle as string | null) ||
    ![sub.trialEndsAt, sub.cancelAt, sub.startedAt].every(nullableText)
  ) {
    throw new Error("Droits invalides");
  }
  return row as unknown as WorkspaceEntitlement;
}
