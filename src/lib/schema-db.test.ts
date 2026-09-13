import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated; create role anon; create role service_role bypassrls; create role supabase_auth_admin;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
  `);
  await db.exec(
    await readFile("supabase/schema/public-before-hardening.sql", "utf8"),
  );
  for (const migration of [
    "20260910200000_atomic_stripe_events.sql",
    "20260910201000_restrict_invoice_billing.sql",
    "20260912090000_checkout_reservations.sql",
    "20260912100000_workspace_access.sql",
    "20260912110000_waitlist_quota.sql",
    "20260912120000_admin_pagination.sql",
    "20260912130000_admin_auth_api.sql",
    "20260912140000_serialize_stripe_sync.sql",
    "20260912150000_task_revisions.sql",
  ]) {
    await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
  }
}, 30_000);
afterAll(async () => {
  await db?.close();
});
it("applique les migrations sur le schéma réel relevé sans données utilisateur", async () => {
  const result = await db.query(
    "select count(*)::int n from pg_tables where schemaname='public'",
  );
  expect(result.rows).toEqual([{ n: 23 }]);
});

const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const C = "00000000-0000-0000-0000-000000000003";
const T = "10000000-0000-0000-0000-000000000001";
const TASK = "20000000-0000-0000-0000-000000000001";
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function seed() {
  await db.exec("reset role; truncate auth.users cascade");
  for (const id of [A, B, C])
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      id + "@example.test",
    ]);
  await db.query(
    "insert into teams(id,name,created_by) values($1,'Equipe A',$2)",
    [T, A],
  );
  await db.query(
    "update profiles set team_id=$1, role=case when id=$2 then 'owner' else 'member' end where id in ($2,$3)",
    [T, A, B],
  );
  await db.query(
    "insert into tasks(id,user_id,team_id,title) values($1,$2,$3,'Partagée')",
    [TASK, A, T],
  );
}
it("isole une équipe étrangère tout en autorisant les collaborateurs", async () => {
  await seed();
  await asUser(C);
  expect((await db.query("select id from tasks")).rows).toEqual([]);
  await asUser(B);
  expect((await db.query("select id from tasks")).rows).toEqual([{ id: TASK }]);
  await db.query("update tasks set title='Corrigée' where id=$1", [TASK]);
});
it("interdit de s’approprier une ligne partagée ou de retirer son partage", async () => {
  await seed();
  await asUser(B);
  await expect(
    db.query("update tasks set user_id=$1 where id=$2", [B, TASK]),
  ).rejects.toThrow(/immuable/);
  await expect(
    db.query("update tasks set team_id=null where id=$1", [TASK]),
  ).rejects.toThrow(/propriétaire/);
  await asUser(A);
  await db.query("update tasks set team_id=null where id=$1", [TASK]);
});
it("une révocation en base coupe immédiatement les données privées", async () => {
  await seed();
  await db.query(
    "update profiles set subscription_status='inactive' where id=$1",
    [B],
  );
  await asUser(B);
  expect((await db.query("select id from tasks")).rows).toEqual([]);
  await expect(
    db.query("insert into tasks(user_id,title) values($1,'Interdite')", [B]),
  ).rejects.toThrow(/row-level security/);
});
it("les champs de facturation et le rôle restent protégés au niveau des colonnes", async () => {
  await seed();
  await asUser(A);
  await db.query("update profiles set full_name='Prénom' where id=$1", [A]);
  await expect(
    db.query("update profiles set is_super_admin=true where id=$1", [A]),
  ).rejects.toThrow(/permission denied/);
  await expect(db.query("truncate tasks cascade")).rejects.toThrow(
    /permission denied/,
  );
});
it("refuse une inscription sur le créneau privé d’un autre compte", async () => {
  await seed();
  const shift = (
    await db.query<{ id: string }>(
      "insert into shifts(user_id,title,kind,date) values($1,'Privé','autre','2026-10-01') returning id",
      [A],
    )
  ).rows[0].id;
  await asUser(B);
  await expect(
    db.query("insert into shift_signups(shift_id,user_id) values($1,$2)", [
      shift,
      B,
    ]),
  ).rejects.toThrow(/inaccessible/);
});
it("le propriétaire ne peut abandonner son équipe par un changement silencieux", async () => {
  await seed();
  await asUser(A);
  await expect(db.query("select create_team('Autre')")).rejects.toThrow(
    /Quittez/,
  );
  await expect(db.query("select leave_team()")).rejects.toThrow(/transférer/);
  await asUser(B);
  await db.query("select leave_team()");
});
it("transfère la propriété uniquement à un membre de la même équipe", async () => {
  await seed();
  await asUser(B);
  await expect(db.query("select transfer_team($1)", [C])).rejects.toThrow(
    /refusé/,
  );
  await asUser(A);
  await expect(db.query("select transfer_team($1)", [C])).rejects.toThrow(
    /hors équipe/,
  );
  await db.query("select transfer_team($1)", [B]);
  await db.query("select leave_team()");
  await asUser(B);
  expect(
    (await db.query("select created_by from teams where id=$1", [T])).rows,
  ).toEqual([{ created_by: B }]);
});
it("partage atomiquement le quota entre appels et refuse les clients publics", async () => {
  await db.exec("reset role; truncate request_quotas");
  for (let i = 0; i < 60; i++)
    expect((await db.query("select consume_waitlist_quota() ok")).rows).toEqual(
      [{ ok: true }],
    );
  expect((await db.query("select consume_waitlist_quota() ok")).rows).toEqual([
    { ok: false },
  ]);
  await asUser(A);
  await expect(db.query("select consume_waitlist_quota()")).rejects.toThrow(
    /permission denied/,
  );
});

it("pagine les comptes au serveur avec des totaux complets et un ordre stable", async () => {
  await seed();
  await db.query("update profiles set is_super_admin=true where id=$1", [A]);
  await db.exec(
    "insert into auth.users(id,email) select gen_random_uuid(),'fixture-'||n||'@example.test' from generate_series(1,1050) n",
  );
  await asUser(B);
  await expect(
    db.query("select admin_accounts_page('', 'all',0)"),
  ).rejects.toThrow(/refusé/);
  await asUser(A);
  const first = (
    await db.query<{ page: { accounts: { id: string }[]; matched: number } }>(
      "select admin_accounts_page('', 'all',0) page",
    )
  ).rows[0].page;
  const second = (
    await db.query<{ page: { accounts: { id: string }[] } }>(
      "select admin_accounts_page('', 'all',50) page",
    )
  ).rows[0].page;
  expect(first.matched).toBe(1053);
  expect(first.accounts).toHaveLength(50);
  expect(second.accounts).toHaveLength(50);
  expect(
    second.accounts.every(
      (row) => !first.accounts.some((other) => other.id === row.id),
    ),
  ).toBe(true);
});

it("un bail expiré ne peut appliquer un état Stripe devenu obsolète", async () => {
  await seed();
  const lease = async () =>
    (
      await db.query<{ token: string }>(
        "select acquire_stripe_sync('cus_test') token",
      )
    ).rows[0].token;
  const first = await lease();
  expect(first).toBeTruthy();
  expect(await lease()).toBeNull();
  await db.exec(
    "update stripe_sync_leases set expires_at=now()-interval '1 second'",
  );
  const second = await lease();
  expect(second).not.toBe(first);
  await expect(
    db.query(
      "select apply_stripe_event_serialized('evt_stale','test',$1,'cus_test',null,null,null,$2)",
      [A, first],
    ),
  ).rejects.toThrow(/obsolète/);
  await db.query("select release_stripe_sync('cus_test',$1)", [first]);
  expect(await lease()).toBeNull();
  await db.query("select release_stripe_sync('cus_test',$1)", [second]);
});

it("détecte deux modifications de tâche à partir de la même révision", async () => {
  await seed();
  await asUser(A);
  const version = (
    await db.query<{ updated_at: string }>(
      "select updated_at::text from tasks where id=$1",
      [TASK],
    )
  ).rows[0].updated_at;
  const first = await db.query(
    "update tasks set title='Première' where id=$1 and updated_at=$2 returning id",
    [TASK, version],
  );
  const stale = await db.query(
    "update tasks set title='Ancienne' where id=$1 and updated_at=$2 returning id",
    [TASK, version],
  );
  expect(first.rows).toHaveLength(1);
  expect(stale.rows).toHaveLength(0);
});

it("réserve l’édition du plan au propriétaire tout en permettant sa consultation", async () => {
  await seed();
  await asUser(A);
  const id = (
    await db.query<{ id: string }>(
      "insert into campaigns(team_id,election) values($1,'Initiale') returning id",
      [T],
    )
  ).rows[0].id;
  await asUser(B);
  expect(
    (await db.query("select id from campaigns where id=$1", [id])).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "update campaigns set election='Interdite' where id=$1 returning id",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("delete from campaigns where id=$1 returning id", [id]))
      .rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "insert into campaign_sectors(team_id,name) values($1,'Interdit')",
      [T],
    ),
  ).rejects.toThrow(/row-level security/);
  await asUser(A);
  expect(
    (
      await db.query(
        "update campaigns set election='Autorisée' where id=$1 returning id",
        [id],
      )
    ).rows,
  ).toHaveLength(1);
});
