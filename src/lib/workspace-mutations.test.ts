import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const mock = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  toast: vi.fn(),
  rejection: null as Error | null,
  client: null as unknown,
}));
vi.mock("@/lib/identity", () => ({
  getIdentity: async () => ({ userId: "user_1", teamId: "team_1" }),
  onIdentityChange: vi.fn(),
}));
vi.mock("@/components/toaster", () => ({ toast: { error: mock.toast } }));
vi.mock("@/lib/private-query", () => ({
  getPrivateQueryClient: () => mock.client,
  usePrivateQuery: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      const query = {
        insert: () => query,
        update: () => query,
        upsert: () => query,
        delete: () => query,
        eq: () => query,
        select: () => query,
        single: () => query,
        maybeSingle: () => query,
        then: (
          resolve: (v: typeof mock.result) => unknown,
          reject: (reason: unknown) => unknown,
        ) =>
          (mock.rejection
            ? Promise.reject(mock.rejection)
            : Promise.resolve(mock.result)
          ).then(resolve, reject),
      };
      return query;
    },
  }),
}));
import {
  addShift,
  deleteShift,
  joinShift,
  leaveShift,
  updateShift,
  type Shift,
} from "./shifts";
import { updateTask, deleteTask } from "./tasks";
import { addReport, deleteReport } from "./canvass";
import { addSector, saveCampaign, deleteSector } from "./campaign";

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mock.client = qc;
  mock.rejection = null;
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
    qc.setQueryData(["campaign"], {
      campaign: null,
      hasTeam: true,
      sectors: [{ id: "sec1" }],
    });
    await deleteShift("s1");
    await deleteReport("r1");
    await deleteSector("sec1");
    expect(qc.getQueryData(["shifts"])).toEqual([{ id: "s1" }]);
    expect(qc.getQueryData(["canvass-reports"])).toEqual([{ id: "r1" }]);
    expect(qc.getQueryData(["campaign"])).toMatchObject({
      sectors: [{ id: "sec1" }],
    });
  });
  it("annule l'inscription et la désinscription optimistes en erreur", async () => {
    qc.setQueryData(
      ["shifts"],
      [{ id: "s1", joined: false, signups: [], teamId: "team_1" }],
    );
    await joinShift("s1");
    expect(qc.getQueryData<Shift[]>(["shifts"])?.[0]).toMatchObject({
      joined: false,
      signups: [],
    });
    qc.setQueryData(
      ["shifts"],
      [{ id: "s1", joined: true, signups: ["user_1"], teamId: "team_1" }],
    );
    await leaveShift("s1");
    expect(qc.getQueryData<Shift[]>(["shifts"])?.[0]).toMatchObject({
      joined: true,
      signups: ["user_1"],
    });
  });
  it("restaure la campagne si l'écriture est refusée", async () => {
    const campaign = {
      election: "Avant",
      target: null,
      registered: null,
      turnoutTarget: null,
      scoreTarget: null,
    };
    qc.setQueryData(["campaign"], { campaign, sectors: [], hasTeam: true });
    await saveCampaign({ election: "Après" });
    expect(qc.getQueryData(["campaign"])).toMatchObject({ campaign });
  });
});

it("restaure une tâche en conflit sans remplacer les autres entités", async () => {
  const first = {
    id: "task-1",
    title: "Avant",
    updatedAt: "2026-09-12T00:00:00Z",
  };
  const second = {
    id: "task-2",
    title: "Autre tâche",
    updatedAt: "2026-09-12T00:00:00Z",
  };
  qc.setQueryData(["tasks"], [first, second]);
  mock.result = { data: null, error: null };
  await updateTask("task-1", { title: "Modification périmée" });
  expect(qc.getQueryData(["tasks"])).toEqual([first, second]);
  expect(mock.toast).toHaveBeenCalledWith(expect.stringContaining("changé"));
});
it("restaure une suppression refusée sans perdre les autres tâches", async () => {
  const task = { id: "task-1", updatedAt: "2026-09-12T00:00:00Z" };
  qc.setQueryData(["tasks"], [task, { id: "task-2" }]);
  await deleteTask("task-1");
  expect(qc.getQueryData(["tasks"])).toEqual([task, { id: "task-2" }]);
});

it.each(["update", "delete"])(
  "restaure la tâche après une exception réseau (%s)",
  async (operation) => {
    const task = {
      id: "task-1",
      title: "Avant",
      updatedAt: "2026-09-12T00:00:00Z",
    };
    qc.setQueryData(["tasks"], [task]);
    mock.rejection = new Error("connection interrupted");
    if (operation === "update") await updateTask(task.id, { title: "Après" });
    else await deleteTask(task.id);
    expect(qc.getQueryData(["tasks"])).toEqual([task]);
    expect(mock.toast).toHaveBeenCalledOnce();
  },
);
