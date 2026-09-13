import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

// Schéma minimal de contrat, pas une copie prétendue de la base production.
// Les migrations initiales Supabase manquent encore dans le dépôt.
const USER = "00000000-0000-0000-0000-000000000001";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.profiles (
      id uuid primary key, subscription_status text not null default 'trial',
      subscription_tier text default 'candidat', billing_cycle text,
      subscription_started_at timestamptz, trial_ends_at timestamptz,
      cancel_at timestamptz, stripe_customer_id text unique, stripe_subscription_id text
    );
    create table public.stripe_events (id text primary key, type text not null);
    create table public.billing_events (
      id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id),
      type text not null check (type in ('subscribe','cancel','resume','change_plan','change_cycle','renewal','payment_failed')),
      tier text, cycle text, details jsonb not null
    );
    create function public.billing_price_eur(text, text) returns integer language sql as $$select 49$$;
  `);
  for (const name of [
    "20260910200000_atomic_stripe_events.sql",
    "20260910201000_restrict_invoice_billing.sql",
    "20260912090000_checkout_reservations.sql",
  ]) {
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  }
}, 30_000);

beforeEach(async () => {
  await db.exec(
    "reset role; truncate profiles, stripe_events, billing_events, invoice_billing_accounts cascade;",
  );
  await db.query("insert into profiles(id) values ($1)", [USER]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    USER,
  ]);
});
afterAll(async () => {
  await db?.close();
});

const patch = {
  subscription_status: "active",
  subscription_tier: "equipe",
  billing_cycle: "monthly",
  stripe_subscription_id: "sub_new",
  trial_ends_at: null,
  cancel_at: null,
};
const bill = {
  type: "subscribe",
  tier: "equipe",
  cycle: "monthly",
  details: {},
};
const apply = (
  id = "evt_1",
  body = patch,
  event = bill,
  sub = "sub_new",
  user = USER,
) =>
  db.query<{ applied: boolean }>(
    "select apply_stripe_event($1, 'checkout.session.completed', $2, 'cus_1', $3, $4, $5) as applied",
    [id, user, sub, JSON.stringify(body), JSON.stringify(event)],
  );

describe("transaction de paiement", () => {
  it("enregistre une fois le profil et le journal, même après rejeu", async () => {
    expect((await apply()).rows[0].applied).toBe(true);
    expect((await apply()).rows[0].applied).toBe(false);
    expect(
      (await db.query("select count(*)::int n from billing_events")).rows,
    ).toEqual([{ n: 1 }]);
    expect(
      (await db.query("select subscription_status from profiles")).rows,
    ).toEqual([{ subscription_status: "active" }]);
  });
  it("annule aussi la déduplication et le profil si le journal échoue", async () => {
    await expect(
      apply("evt_1", patch, { ...bill, type: "invalid_type" }),
    ).rejects.toThrow();
    expect(
      (await db.query("select count(*)::int n from stripe_events")).rows,
    ).toEqual([{ n: 0 }]);
    expect(
      (await db.query("select subscription_status from profiles")).rows,
    ).toEqual([{ subscription_status: "trial" }]);
    expect((await apply()).rows[0].applied).toBe(true);
  });
  it("ne perd pas un événement quand le profil n'existe pas", async () => {
    await expect(
      apply(
        "evt_missing",
        patch,
        bill,
        "sub_new",
        "00000000-0000-0000-0000-000000000002",
      ),
    ).rejects.toThrow("Profil Stripe introuvable");
    expect(
      (await db.query("select count(*)::int n from stripe_events")).rows,
    ).toEqual([{ n: 0 }]);
  });
  it("une ancienne résiliation ne coupe pas le nouvel abonnement", async () => {
    await apply();
    await apply(
      "evt_old_cancel",
      {
        ...patch,
        subscription_status: "inactive",
        stripe_subscription_id: null as unknown as string,
      },
      { ...bill, type: "cancel" },
      "sub_old",
    );
    expect(
      (
        await db.query(
          "select subscription_status, stripe_subscription_id from profiles",
        )
      ).rows,
    ).toEqual([
      { subscription_status: "active", stripe_subscription_id: "sub_new" },
    ]);
  });
  it("refuse toute écriture de paiement au rôle authenticated", async () => {
    await db.exec("set role authenticated");
    await expect(apply()).rejects.toThrow(/permission denied/);
  });
});

describe("facturation sur autorisation", () => {
  it("interdit à un compte ordinaire de s'activer gratuitement", async () => {
    await db.exec("set role authenticated");
    await expect(
      db.query("select self_set_plan('equipe', 'monthly')"),
    ).rejects.toThrow(/non autorisée/);
  });
  it("autorise les clients facture explicitement inscrits par un administrateur", async () => {
    await db.query(
      "insert into invoice_billing_accounts(user_id) values ($1)",
      [USER],
    );
    await db.exec("set role authenticated");
    await db.query("select self_set_plan('equipe', 'monthly')");
    await db.query("select self_cancel()");
    await db.query("select self_resume()");
    await db.exec("reset role");
    expect(
      (await db.query("select subscription_status, cancel_at from profiles"))
        .rows,
    ).toEqual([{ subscription_status: "active", cancel_at: null }]);
  });
  it("ne permet pas à l'utilisateur de s'ajouter à la liste d'autorisation", async () => {
    await db.exec("set role authenticated");
    await expect(
      db.query("insert into invoice_billing_accounts(user_id) values ($1)", [
        USER,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
  it("interdit les RPC facture à un compte Stripe, même inscrit dans la liste", async () => {
    await db.query(
      "insert into invoice_billing_accounts(user_id) values ($1)",
      [USER],
    );
    await apply();
    await db.exec("set role authenticated");
    for (const sql of [
      "select self_set_plan('equipe', 'monthly')",
      "select self_cancel()",
      "select self_resume()",
    ]) {
      await expect(db.query(sql)).rejects.toThrow(/non autorisée/);
    }
  });
  it("refuse les paramètres NULL plutôt que d'activer un plan invalide", async () => {
    await db.query(
      "insert into invoice_billing_accounts(user_id) values ($1)",
      [USER],
    );
    await expect(
      db.query("select self_set_plan(null, 'monthly')"),
    ).rejects.toThrow(/Formule invalide/);
    await expect(
      db.query("select self_set_plan('equipe', null)"),
    ).rejects.toThrow(/Cycle invalide/);
  });
});

describe("réservations de paiement", () => {
  const reserve = (price = "price_1") =>
    db.query<{ r: { attempt_id: string; parameters: unknown } }>(
      "select reserve_checkout($1, $2) r",
      [USER, JSON.stringify({ line_items: [{ price }] })],
    );
  it("conserve la même tentative et ses paramètres lors des reprises", async () => {
    const first = (await reserve()).rows[0].r;
    expect((await reserve("price_2")).rows[0].r).toEqual(first);
  });
  it("une ancienne tentative ne peut ni rattacher ni supprimer la nouvelle", async () => {
    const first = (await reserve()).rows[0].r;
    await db.query("select release_expired_checkout($1, $2)", [
      USER,
      first.attempt_id,
    ]);
    const next = (await reserve()).rows[0].r;
    await expect(
      db.query("select attach_checkout($1, $2, 'cs_old')", [
        USER,
        first.attempt_id,
      ]),
    ).rejects.toThrow(/obsolète/);
    await db.query("select release_expired_checkout($1, $2)", [
      USER,
      first.attempt_id,
    ]);
    expect((await reserve()).rows[0].r).toEqual(next);
  });
  it("refuse une deuxième souscription active", async () => {
    await apply();
    await expect(reserve()).rejects.toThrow(/déjà actif/);
  });
  it("interdit la gestion des réservations aux clients publics", async () => {
    await db.exec("set role authenticated");
    await expect(reserve()).rejects.toThrow(/permission denied/);
  });
});
