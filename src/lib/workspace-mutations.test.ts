import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const mock = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown }, toast: vi.fn(), client: null as unknown }));
vi.mock("@/lib/identity", () => ({ getIdentity: async () => ({ userId: "user_1", teamId: "team_1" }), onIdentityChange: vi.fn() }));
vi.mock("@/components/toaster", () => ({ toast: { error: mock.toast } }));
vi.mock("@/providers/query-provider", () => ({ getQueryClient: () => mock.client }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => {
  const query = {
    insert: () => query, update: () => query, upsert: () => query, delete: () => query,
    eq: () => query, select: () => query, single: () => query,
    then: (resolve: (v: typeof mock.result) => unknown) => Promise.resolve(mock.result).then(resolve),
  };
  return query;
} }) }));
import { addShift, deleteShift, joinShift, leaveShift, updateShift, type Shift } from "./shifts";
import { addReport, deleteReport } from "./canvass";
import { addSector, saveCampaign, deleteSector } from "./campaign";

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mock.client = qc;
  mock.result = { data: null, error: { message: "write denied" } };
  mock.toast.mockClear();
});

describe("échecs de sauvegarde", () => {
  it("signale les créations refusées pour conserver les formulaires", async () => {
    expect(await addShift({ title: "Test", date: "2026-09-10" })).toBe(false);
    expect(await updateShift("s1", { title: "Modifié" })).toBe(false);
    expect(await addReport({ date: "2026-09-10" })).toBe(false);
    expect(await addSector({ name: "Test" })).toBe(false);
    expect(mock.toast).toHaveBeenCalledTimes(4);
  });
  it("restaure les lignes après une suppression refusée", async () => {
    qc.setQueryData(["shifts"], [{ id: "s1" }]);
    qc.setQueryData(["canvass-reports"], [{ id: "r1" }]);
    qc.setQueryData(["campaign"], { campaign: null, hasTeam: true, sectors: [{ id: "sec1" }] });
    await deleteShift("s1");
    await deleteReport("r1");
    await deleteSector("sec1");
    expect(qc.getQueryData(["shifts"])).toEqual([{ id: "s1" }]);
    expect(qc.getQueryData(["canvass-reports"])).toEqual([{ id: "r1" }]);
    expect(qc.getQueryData(["campaign"])).toMatchObject({ sectors: [{ id: "sec1" }] });
  });
  it("annule l'inscription et la désinscription optimistes en erreur", async () => {
    qc.setQueryData(["shifts"], [{ id: "s1", joined: false, signups: [], teamId: "team_1" }]);
    await joinShift("s1");
    expect(qc.getQueryData<Shift[]>(["shifts"])?.[0]).toMatchObject({ joined: false, signups: [] });
    qc.setQueryData(["shifts"], [{ id: "s1", joined: true, signups: ["user_1"], teamId: "team_1" }]);
    await leaveShift("s1");
    expect(qc.getQueryData<Shift[]>(["shifts"])?.[0]).toMatchObject({ joined: true, signups: ["user_1"] });
  });
  it("restaure la campagne si l'écriture est refusée", async () => {
    const campaign = { election: "Avant", target: null, registered: null, turnoutTarget: null, scoreTarget: null };
    qc.setQueryData(["campaign"], { campaign, sectors: [], hasTeam: true });
    await saveCampaign({ election: "Après" });
    expect(qc.getQueryData(["campaign"])).toMatchObject({ campaign });
  });
});
