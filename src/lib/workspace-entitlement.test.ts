import { expect, it } from "vitest";
import { parseWorkspaceEntitlement } from "./workspace-entitlement";
const rights = {
  has_access: true,
  team_access: true,
  covered_by_team: true,
  billing_owner_id: "payer",
  team_name: "Équipe",
  seat_limit: 5,
  seats_used: 3,
  subscription: {
    status: "active",
    tier: "equipe",
    trialEndsAt: null,
    cancelAt: null,
    billingCycle: "monthly",
    startedAt: null,
  },
};
it("valide le contrat de couverture partagée", () => {
  expect(parseWorkspaceEntitlement(rights)).toEqual(rights);
});
it.each([
  null,
  {},
  { ...rights, seat_limit: -1 },
  { ...rights, covered_by_team: "true" },
  { ...rights, subscription: { ...rights.subscription, tier: "unknown" } },
])("refuse un contrat invalide %j", (value) => {
  expect(() => parseWorkspaceEntitlement(value)).toThrow(/Droits/);
});
