import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  session: vi.fn(),
  profile: vi.fn(),
  rpc: vi.fn(),
  callback: null as
    | null
    | ((event: string, session: { user: { id: string } } | null) => void),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mock.session,
      onAuthStateChange: (fn: typeof mock.callback) => {
        mock.callback = fn;
      },
    },
    rpc: mock.rpc,
    from: () => ({ select: () => ({ eq: () => ({ single: mock.profile }) }) }),
  }),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const session = (id: string) => ({
  data: { session: { user: { id, email: `${id}@example.test` } } },
  error: null,
});
const profile = (team: string) => ({
  data: { team_id: team, subscription_status: "active" },
  error: null,
});

beforeEach(() => {
  mock.rpc
    .mockReset()
    .mockResolvedValue({
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
  vi.resetModules();
  vi.useFakeTimers();
  mock.session.mockReset().mockResolvedValue(session("A"));
  mock.profile.mockReset().mockResolvedValue(profile("team-A"));
});
afterEach(() => vi.useRealTimers());

describe("cycle de vie de l'identité", () => {
  it("déduplique les lectures concurrentes", async () => {
    const { getIdentity } = await import("./identity");
    const [a, b] = await Promise.all([getIdentity(), getIdentity()]);
    expect(a).toBe(b);
    expect(mock.profile).toHaveBeenCalledTimes(1);
  });
  it("rejette une ancienne réponse après déconnexion", async () => {
    const pending = deferred<ReturnType<typeof profile>>();
    mock.profile.mockReturnValueOnce(pending.promise);
    const identity = await import("./identity");
    const first = identity.getIdentity();
    await vi.waitFor(() => expect(mock.profile).toHaveBeenCalledTimes(1));
    mock.callback!("SIGNED_OUT", null);
    pending.resolve(profile("team-A"));
    expect((await first).userId).toBeNull();
    expect(identity.currentIdentity()?.teamId).toBeNull();
  });
  it("une réponse A tardive rejoint B sans publier A", async () => {
    const pending = deferred<ReturnType<typeof profile>>();
    mock.profile.mockReturnValueOnce(pending.promise);
    const identity = await import("./identity");
    const first = identity.getIdentity();
    await vi.waitFor(() => expect(mock.profile).toHaveBeenCalledTimes(1));
    mock.session.mockResolvedValue(session("B"));
    mock.profile.mockResolvedValue(profile("team-B"));
    mock.callback!("SIGNED_IN", { user: { id: "B" } });
    pending.resolve(profile("team-A"));
    expect(await first).toMatchObject({ userId: "B", teamId: "team-B" });
    expect(identity.currentIdentity()?.userId).toBe("B");
  });
  it("ne transforme pas une erreur de profil en identité partielle", async () => {
    mock.profile.mockResolvedValueOnce({
      data: null,
      error: new Error("unavailable"),
    });
    const identity = await import("./identity");
    await expect(identity.getIdentity()).rejects.toThrow("unavailable");
    expect(identity.currentIdentity()).toBeNull();
    expect((await identity.getIdentity()).teamId).toBe("team-A");
  });
  it("ne refait pas les lectures sur un simple renouvellement de token", async () => {
    const identity = await import("./identity");
    await identity.getIdentity();
    const revision = identity.identityRevision();
    mock.callback!("TOKEN_REFRESHED", { user: { id: "A" } });
    await vi.runAllTimersAsync();
    expect(identity.identityRevision()).toBe(revision);
    expect(mock.profile).toHaveBeenCalledTimes(1);
  });
  it("diffère les abonnés au-delà du callback Supabase", async () => {
    const identity = await import("./identity");
    await identity.getIdentity();
    const listener = vi.fn();
    identity.onIdentityChange(listener);
    mock.callback!("SIGNED_OUT", null);
    expect(listener).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(listener).toHaveBeenCalled();
  });
});

it("utilise la couverture de l’équipe et refuse un contrat de droits absent", async () => {
  const identity = await import("./identity");
  const response = await mock.rpc();
  response.data.covered_by_team = true;
  mock.rpc.mockResolvedValue(response);
  expect((await identity.getIdentity()).subscription?.coveredByTeam).toBe(true);
  mock.rpc.mockResolvedValue({ data: null, error: null });
  await expect(identity.refreshIdentity()).rejects.toThrow(
    "Droits indisponibles",
  );
});
it("conserve un périmètre personnel lorsque le compte ne dispose plus d’un siège partagé", async () => {
  const response = await mock.rpc();
  response.data.team_access = false;
  mock.rpc.mockResolvedValue(response);
  const { getIdentity } = await import("./identity");
  expect((await getIdentity()).teamId).toBeNull();
});
