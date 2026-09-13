import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  serviceRoleConfigured: () => true,
  createServiceClient: () => ({
    rpc: mock.rpc,
    from: () => ({ upsert: mock.upsert }),
  }),
}));
import { POST } from "./route";
const request = (body = '{"email":"TEST@example.test"}') =>
  new Request("https://app.test/api/waitlist", { method: "POST", body });
beforeEach(() => {
  vi.resetAllMocks();
  mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.upsert.mockResolvedValue({ error: null });
});
it("refuse les corps trop gros avant toute requête en base", async () => {
  expect((await POST(request("x".repeat(5000)))).status).toBe(413);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("refuse une adresse invalide", async () => {
  expect((await POST(request('{"email":"invalid"}'))).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("respecte le quota partagé sans écrire la liste", async () => {
  mock.rpc.mockResolvedValue({ data: false, error: null });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(mock.upsert).not.toHaveBeenCalled();
});
it("ferme les inscriptions si le quota est indisponible", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { code: "timeout" } });
  expect((await POST(request())).status).toBe(503);
  expect(mock.upsert).not.toHaveBeenCalled();
});
it("normalise et déduplique sans révéler les inscriptions existantes", async () => {
  expect(await (await POST(request())).json()).toEqual({ ok: true });
  expect(mock.upsert).toHaveBeenCalledWith(
    { email: "test@example.test", source: "landing" },
    { onConflict: "email", ignoreDuplicates: true },
  );
});
