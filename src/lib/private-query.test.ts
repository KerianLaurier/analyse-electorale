import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
const mock = vi.hoisted(() => ({
  user: "A",
  team: "one",
  revision: 0,
  client: null as unknown,
}));
vi.mock("@/lib/identity", () => ({
  currentIdentity: () => ({ userId: mock.user, teamId: mock.team }),
  identityRevision: () => mock.revision,
  onIdentityChange: vi.fn(),
}));
vi.mock("@/providers/query-provider", () => ({
  getQueryClient: () => mock.client,
}));
import { getPrivateQueryClient } from "./private-query";
beforeEach(() => {
  mock.client = new QueryClient();
  mock.user = "A";
  mock.team = "one";
  mock.revision = 0;
});
describe("isolation du cache privé", () => {
  it("sépare deux utilisateurs et deux équipes", () => {
    getPrivateQueryClient().setQueryData(["contacts"], ["private-A"]);
    mock.user = "B";
    expect(getPrivateQueryClient().getQueryData(["contacts"])).toBeUndefined();
    mock.user = "A";
    mock.team = "two";
    expect(getPrivateQueryClient().getQueryData(["contacts"])).toBeUndefined();
  });
  it("une mutation capturée avant déconnexion ne peut plus écrire", () => {
    const old = getPrivateQueryClient();
    old.setQueryData(["contacts"], ["before"]);
    mock.revision += 1;
    getPrivateQueryClient().setQueryData(["contacts"], ["current"]);
    old.setQueryData(["contacts"], ["late response"]);
    expect(getPrivateQueryClient().getQueryData(["contacts"])).toEqual([
      "current",
    ]);
    expect(old.getQueryData(["contacts"])).toBeUndefined();
  });
  it("ne mélange pas données publiques et privées de même nom", () => {
    (mock.client as QueryClient).setQueryData(["contacts"], ["public"]);
    getPrivateQueryClient().setQueryData(["contacts"], ["private"]);
    expect((mock.client as QueryClient).getQueryData(["contacts"])).toEqual([
      "public",
    ]);
    expect(getPrivateQueryClient().getQueryData(["contacts"])).toEqual([
      "private",
    ]);
  });
});
