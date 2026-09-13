import { beforeEach, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckoutPendingError, getOrCreateCheckout } from "./checkout-session";

const params = { line_items: [{ price: "price_1", quantity: 1 }] };
const reservation = {
  attempt_id: "attempt_1",
  session_id: null,
  expires_at: "2026-09-12T12:00:00Z",
  parameters: params,
};
const rpc = vi.fn(),
  create = vi.fn(),
  retrieve = vi.fn(),
  expire = vi.fn();
const admin = { rpc } as unknown as SupabaseClient;
const stripe = {
  checkout: { sessions: { create, retrieve, expire } },
} as unknown as Stripe;
const run = (parameters = params) =>
  getOrCreateCheckout(admin, stripe, "user_1", parameters);
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockImplementation(async (name: string) => ({
    data: name === "reserve_checkout" ? reservation : null,
    error: null,
  }));
  create.mockResolvedValue({
    id: "cs_1",
    status: "open",
    url: "https://checkout.stripe.com/fixture",
  });
});
it("réutilise une clé et des paramètres durables après un timeout de rattachement", async () => {
  rpc.mockImplementationOnce(async () => ({ data: reservation, error: null }));
  rpc.mockImplementationOnce(async () => ({ error: new Error("timeout") }));
  await expect(run()).rejects.toThrow("timeout");
  await run();
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
  expect(create.mock.calls[0][1]).toEqual({
    idempotencyKey: "checkout:attempt_1",
  });
});
it("réutilise une session ouverte sans en créer une nouvelle", async () => {
  rpc.mockResolvedValue({
    data: { ...reservation, session_id: "cs_1" },
    error: null,
  });
  retrieve.mockResolvedValue({ id: "cs_1", status: "open" });
  await run();
  expect(create).not.toHaveBeenCalled();
});
it("attend le webhook si Stripe a déjà encaissé", async () => {
  create.mockResolvedValue({ id: "cs_1", status: "complete" });
  await expect(run()).rejects.toBeInstanceOf(CheckoutPendingError);
  expect(rpc).not.toHaveBeenCalledWith(
    "release_expired_checkout",
    expect.anything(),
  );
});
it("ne renouvelle jamais une session sur la seule horloge locale", async () => {
  create.mockRejectedValue(new Error("expiration passée"));
  await expect(run()).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("ne crée pas une deuxième formule si Stripe refuse de fermer la première", async () => {
  expire.mockRejectedValue(new Error("already paid"));
  await expect(
    run({ line_items: [{ price: "price_2", quantity: 1 }] }),
  ).rejects.toThrow("already paid");
  expect(create).toHaveBeenCalledTimes(1);
  expect(rpc).not.toHaveBeenCalledWith(
    "release_expired_checkout",
    expect.anything(),
  );
});
it("renouvelle uniquement après confirmation Stripe de l’expiration", async () => {
  create.mockResolvedValueOnce({ id: "cs_old", status: "expired" });
  await run();
  expect(rpc).toHaveBeenCalledWith("release_expired_checkout", {
    p_user_id: "user_1",
    p_attempt_id: "attempt_1",
  });
  expect(create).toHaveBeenCalledTimes(2);
});
