import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), retrieve: vi.fn(), maybeSingle: vi.fn() }));
const stripe = new Stripe("sk_test_local_fixture");
vi.mock("@/lib/supabase/admin", () => ({
  serviceRoleConfigured: () => true,
  createServiceClient: () => ({
    rpc: mock.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.maybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/stripe")>(),
  stripeEnabled: () => true,
  getStripe: () => ({ webhooks: stripe.webhooks, subscriptions: { retrieve: mock.retrieve } }),
}));
import { POST } from "./route";

const SECRET = "whsec_local_fixture";
const subscription = { id: "sub_1", status: "active", customer: "cus_1", metadata: { user_id: "user_1" } };
function request(type = "checkout.session.completed", object: unknown = {
  id: "cs_1", mode: "subscription", subscription: "sub_1", customer: "cus_1", metadata: { user_id: "user_1" },
}) {
  const payload = JSON.stringify({ id: "evt_1", type, data: { object } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return new Request("https://example.test/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } });
}
beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  mock.rpc.mockReset().mockResolvedValue({ data: true, error: null });
  mock.retrieve.mockReset().mockResolvedValue(subscription);
  mock.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("webhook signé", () => {
  it("fait une unique écriture transactionnelle", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("apply_stripe_event", expect.objectContaining({
      p_event_id: "evt_1", p_user_id: "user_1", p_customer_id: "cus_1",
      p_patch: expect.objectContaining({ subscription_status: "active" }),
      p_billing_event: expect.objectContaining({ type: "subscribe" }),
    }));
  });
  it("retourne 500 si Supabase renvoie une erreur sans lever d'exception", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    expect((await POST(request())).status).toBe(500);
  });
  it("retourne un succès pour un doublon déjà validé en base", async () => {
    mock.rpc.mockResolvedValue({ data: false, error: null });
    expect(await (await POST(request())).json()).toEqual({ received: true, duplicate: true });
  });
  it("refuse une signature invalide avant toute écriture", async () => {
    expect((await POST(new Request("https://example.test/api/stripe/webhook", {
      method: "POST", body: "{}", headers: { "stripe-signature": "invalid" },
    }))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("un ancien snapshot actif relit l'état Stripe désormais annulé", async () => {
    mock.retrieve.mockResolvedValue({ ...subscription, status: "canceled" });
    expect((await POST(request("customer.subscription.updated", subscription))).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("apply_stripe_event", expect.objectContaining({
      p_patch: expect.objectContaining({ subscription_status: "inactive" }),
    }));
  });
  it("une panne de réconciliation ne devient pas un client inconnu acquitté", async () => {
    mock.maybeSingle.mockResolvedValue({ data: null, error: { message: "timeout" } });
    expect((await POST(request("invoice.payment_failed", { customer: "cus_1", metadata: {} }))).status).toBe(500);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
