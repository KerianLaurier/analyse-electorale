import { describe, expect, it } from "vitest";
import { billingPhase, computeAccess, daysLeft, nextRenewal } from "@/lib/billing";

const NOW = new Date("2026-07-08T12:00:00Z");
const FUTURE = "2026-07-20T00:00:00Z";
const PAST = "2026-07-01T00:00:00Z";

describe("computeAccess", () => {
  it("accorde l'accès en essai non expiré", () => {
    expect(computeAccess("trial", FUTURE, null, false, NOW)).toBe(true);
  });
  it("refuse l'essai expiré", () => {
    expect(computeAccess("trial", PAST, null, false, NOW)).toBe(false);
  });
  it("tolère un essai sans date de fin (legacy)", () => {
    expect(computeAccess("trial", null, null, false, NOW)).toBe(true);
  });
  it("accorde l'accès à un abonnement actif", () => {
    expect(computeAccess("active", null, null, false, NOW)).toBe(true);
  });
  it("garde l'accès ouvert après résiliation jusqu'à l'échéance", () => {
    expect(computeAccess("active", null, FUTURE, false, NOW)).toBe(true);
  });
  it("coupe l'accès une fois la résiliation échue", () => {
    expect(computeAccess("active", null, PAST, false, NOW)).toBe(false);
  });
  it("refuse un compte inactif", () => {
    expect(computeAccess("inactive", null, null, false, NOW)).toBe(false);
  });
  it("laisse toujours passer un super-admin", () => {
    expect(computeAccess("inactive", null, null, true, NOW)).toBe(true);
    expect(computeAccess("active", null, PAST, true, NOW)).toBe(true);
  });
});

describe("daysLeft", () => {
  it("arrondit au jour supérieur", () => {
    expect(daysLeft("2026-07-09T13:00:00Z", NOW)).toBe(2); // 25 h → 2 jours
    expect(daysLeft("2026-07-09T11:00:00Z", NOW)).toBe(1); // 23 h → 1 jour
  });
  it("plancher à 0 pour une date passée", () => {
    expect(daysLeft(PAST, NOW)).toBe(0);
  });
  it("null sans date ou pour une date invalide", () => {
    expect(daysLeft(null, NOW)).toBeNull();
    expect(daysLeft("n'importe quoi", NOW)).toBeNull();
  });
});

describe("nextRenewal", () => {
  it("roule mois par mois depuis le début d'abonnement", () => {
    // Souscrit le 15 mai → échéances 15 juin, 15 juillet. Au 8 juillet, la
    // prochaine est le 15 juillet.
    const next = nextRenewal("2026-05-15T09:30:00Z", "monthly", NOW);
    expect(next.toISOString()).toBe("2026-07-15T09:30:00.000Z");
  });
  it("roule à l'année en cycle annuel", () => {
    const next = nextRenewal("2025-11-02T00:00:00Z", "yearly", NOW);
    expect(next.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });
  it("borne les fins de mois comme Postgres (31 janv → 28 févr → 28 mars)", () => {
    const next = nextRenewal("2026-01-31T00:00:00Z", "monthly", new Date("2026-02-14T00:00:00Z"));
    expect(next.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    const after = nextRenewal("2026-01-31T00:00:00Z", "monthly", new Date("2026-03-01T00:00:00Z"));
    expect(after.toISOString()).toBe("2026-03-28T00:00:00.000Z");
  });
  it("repli sur mensuel sans cycle connu, depuis maintenant sans date de début", () => {
    const next = nextRenewal(null, null, NOW);
    expect(next.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.toISOString()).toBe("2026-08-08T12:00:00.000Z");
  });
});

describe("billingPhase", () => {
  it("distingue les six phases du parcours", () => {
    expect(billingPhase("trial", FUTURE, null, NOW)).toBe("trialing");
    expect(billingPhase("trial", PAST, null, NOW)).toBe("trial_over");
    expect(billingPhase("active", null, null, NOW)).toBe("active");
    expect(billingPhase("active", null, FUTURE, NOW)).toBe("canceling");
    expect(billingPhase("active", null, PAST, NOW)).toBe("ended");
    expect(billingPhase("inactive", null, null, NOW)).toBe("inactive");
  });
});
