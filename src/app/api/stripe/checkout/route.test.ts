import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  user: { id: "user_1", email: "test@example.test" } as {
    id: string;
    email: string;
  } | null,
  profile: vi.fn(),
  rpc: vi.fn(),
  attach: vi.fn(),
  customer: vi.fn(),
  checkout: vi.fn(),
  portal: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: undefined } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: mock.rpc,
    auth: { getUser: async () => ({ data: { user: mock.user } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceRoleConfigured: () => true,
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: mock.profile }) }),
      update: () => ({
        eq: () => ({ select: () => ({ single: mock.attach }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/stripe", () => ({
  stripeEnabled: () => true,
  SELF_SERVICE_TIERS: ["candidat", "equipe"],
  resolvePriceId: async () => "price_1",
  getStripe: () => ({
    customers: { create: mock.customer },
    checkout: { sessions: { create: mock.checkout } },
    billingPortal: { sessions: { create: mock.portal } },
  }),
}));
vi.mock("@/lib/checkout-session", () => ({
  CheckoutPendingError: class extends Error {},
  getOrCreateCheckout: (
    _admin: unknown,
    _stripe: unknown,
    _user: unknown,
    parameters: unknown,
  ) => mock.checkout(parameters),
}));
import { POST as checkout } from "./route";
import { POST as portal } from "../portal/route";

const profile = {
  subscription_status: "trial",
  stripe_customer_id: null,
  stripe_subscription_id: null,
};
function request(body: unknown = { tier: "equipe", cycle: "monthly" }) {
  return new Request("https://app.example.test/api/stripe/checkout", {
    method: "POST",
    headers: { Origin: "https://untrusted.example.test" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_local_fixture");
  vi.clearAllMocks();
  mock.rpc.mockResolvedValue({
    data: {
      has_access: true,
      team_access: true,
      covered_by_team: false,
      billing_owner_id: null,
      team_name: null,
      seat_limit: 0,
      seats_used: 0,
      subscription: {
        status: "active",
        tier: "equipe",
        trialEndsAt: null,
        cancelAt: null,
        billingCycle: "monthly",
        startedAt: null,
      },
    },
    error: null,
  });
  mock.user = { id: "user_1", email: "test@example.test" };
  mock.profile.mockResolvedValue({ data: profile, error: null });
  mock.attach.mockResolvedValue({ data: { id: "user_1" }, error: null });
  mock.customer.mockResolvedValue({ id: "cus_1" });
  mock.checkout.mockResolvedValue({
    url: "https://checkout.stripe.com/fixture",
  });
  mock.portal.mockResolvedValue({ url: "https://billing.stripe.com/fixture" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("création d'un paiement", () => {
  it("ne facture pas si le webhook d'activation est absent", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await checkout(request())).status).toBe(503);
    expect(mock.checkout).not.toHaveBeenCalled();
  });
  it.each([null, [], "invalid", { tier: "parti", cycle: "monthly" }])(
    "refuse le corps invalide %j",
    async (body) => {
      expect((await checkout(request(body))).status).toBe(400);
      expect(mock.customer).not.toHaveBeenCalled();
    },
  );
  it("refuse les appels anonymes", async () => {
    mock.user = null;
    expect((await checkout(request())).status).toBe(401);
    expect((await portal(request())).status).toBe(401);
  });
  it("ne lance aucun paiement si le rattachement du client échoue", async () => {
    mock.attach.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });
    expect((await checkout(request())).status).toBe(502);
    expect(mock.checkout).not.toHaveBeenCalled();
  });
  it("réutilise une clé client stable et ignore l'en-tête Origin", async () => {
    expect((await checkout(request())).status).toBe(200);
    expect(mock.customer).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: "customer:user_1",
    });
    expect(mock.checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url:
          "https://app.example.test/auth/abonnement?checkout=success",
        cancel_url:
          "https://app.example.test/auth/abonnement?checkout=cancelled",
      }),
    );
  });
  it("redirige la gestion d'un abonnement actif vers le portail", async () => {
    mock.profile.mockResolvedValue({
      data: {
        ...profile,
        subscription_status: "active",
        stripe_subscription_id: "sub_1",
      },
      error: null,
    });
    expect((await checkout(request())).status).toBe(409);
    expect(mock.checkout).not.toHaveBeenCalled();
  });
  it("renvoie une erreur JSON quand Stripe est indisponible", async () => {
    mock.checkout.mockRejectedValueOnce(new Error("timeout"));
    const response = await checkout(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });
  it("le portail utilise aussi l'origine serveur et le compte connecté", async () => {
    mock.profile.mockResolvedValue({
      data: {
        ...profile,
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
      },
      error: null,
    });
    expect(
      (await portal(request({ flow: "subscription_update" }))).status,
    ).toBe(200);
    expect(mock.portal).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_1",
        return_url: "https://app.example.test/auth/abonnement",
      }),
    );
  });
  it("ne lance pas le portail si la lecture du profil échoue", async () => {
    mock.profile.mockResolvedValue({
      data: null,
      error: { message: "timeout" },
    });
    expect((await portal(request())).status).toBe(502);
    expect(mock.portal).not.toHaveBeenCalled();
  });
});

it("ne crée aucun client ni paiement pour un membre couvert", async () => {
  const response = await mock.rpc();
  response.data.covered_by_team = true;
  mock.rpc.mockResolvedValue(response);
  expect((await checkout(request())).status).toBe(409);
  expect(mock.customer).not.toHaveBeenCalled();
  expect(mock.checkout).not.toHaveBeenCalled();
});
it("ne facture pas si les droits de l’équipe ne sont pas vérifiables", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: new Error("timeout") });
  expect((await checkout(request())).status).toBe(502);
  expect(mock.customer).not.toHaveBeenCalled();
});
