import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  user: { id: "admin" } as { id: string } | null,
  superAdmin: true,
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mock.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { is_super_admin: mock.superAdmin },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  serviceRoleConfigured: () => true,
  createServiceClient: () => ({
    auth: { admin: { createUser: mock.create, deleteUser: mock.remove } },
    from: () => ({
      update: () => ({
        eq: () => ({ select: () => ({ single: mock.update }) }),
      }),
    }),
  }),
}));
import { POST } from "./route";
const body = {
  email: "test@example.test",
  password: "fixture-password-123",
  fullName: "Test",
  organisation: null,
  status: "trial",
  tier: "candidat",
  isSuperAdmin: false,
  trialEndsAt: null,
};
const run = (input: unknown = body) =>
  POST(
    new Request("https://app.test/api/admin/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
beforeEach(() => {
  vi.resetAllMocks();
  mock.user = { id: "admin" };
  mock.superAdmin = true;
  mock.create.mockResolvedValue({
    data: { user: { id: "new-user" } },
    error: null,
  });
  mock.update.mockResolvedValue({ data: { id: "new-user" }, error: null });
  mock.remove.mockResolvedValue({ error: null });
});
it("refuse les anonymes et utilisateurs ordinaires", async () => {
  mock.user = null;
  expect((await run()).status).toBe(401);
  mock.user = { id: "member" };
  mock.superAdmin = false;
  expect((await run()).status).toBe(403);
  expect(mock.create).not.toHaveBeenCalled();
});
it("valide les paramètres avant de créer un compte", async () => {
  expect((await run({ ...body, password: "short" })).status).toBe(400);
  expect(mock.create).not.toHaveBeenCalled();
});
it("crée via Auth et renvoie uniquement l’identifiant", async () => {
  const response = await run();
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id: "new-user" });
  expect(mock.create).toHaveBeenCalledWith(
    expect.objectContaining({ email: body.email, password: body.password }),
  );
});
it("annule le compte nouvellement créé si sa configuration échoue", async () => {
  mock.update.mockResolvedValue({ error: { code: "timeout" } });
  expect((await run()).status).toBe(502);
  expect(mock.remove).toHaveBeenCalledWith("new-user");
});
it("signale explicitement une création partielle si la compensation échoue", async () => {
  mock.update.mockResolvedValue({ error: { code: "timeout" } });
  mock.remove.mockResolvedValue({ error: { code: "timeout" } });
  expect(await (await run()).json()).toMatchObject({
    error: expect.stringContaining("configuration incomplète"),
  });
});

it("refuse les formulaires et les requêtes provenant d’une autre origine", async () => {
  for (const headers of <Record<string, string>[]>[
    { "content-type": "text/plain" },
    { "content-type": "application/json", origin: "https://foreign.test" },
  ]) {
    const result = await POST(
      new Request("https://app.test/api/admin/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
    expect([403, 415]).toContain(result.status);
  }
  expect(mock.create).not.toHaveBeenCalled();
});
