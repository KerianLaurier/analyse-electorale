import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeEach, expect, it, vi } from "vitest";

const source = readFileSync("public/sw.js", "utf8");
type Event = {
  request: Request;
  respondWith: (response: Promise<Response>) => void;
  waitUntil: (value: Promise<unknown>) => void;
};
let listeners: Record<string, (event: Event) => void>;
const cache = { match: vi.fn(), put: vi.fn(), keys: vi.fn(), delete: vi.fn() };
const storage = {
  open: vi.fn(),
  keys: vi.fn(),
  delete: vi.fn(),
  match: vi.fn(),
};
const network = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  listeners = {};
  storage.open.mockResolvedValue(cache);
  cache.keys.mockResolvedValue([]);
  network.mockResolvedValue(
    new Response('{"value":1}', { headers: { "content-length": "11" } }),
  );
  runInNewContext(source, {
    URL,
    Request,
    Response,
    fetch: network,
    caches: storage,
    self: {
      location: { origin: "https://app.test" },
      addEventListener: (name: string, handler: (event: Event) => void) => {
        listeners[name] = handler;
      },
    },
  });
});
async function dispatch(url: string, init?: RequestInit) {
  let response: Promise<Response> | undefined;
  const pending: Promise<unknown>[] = [];
  listeners.fetch({
    request: new Request(url, init),
    respondWith: (value) => {
      response = value;
    },
    waitUntil: (value) => {
      pending.push(value);
    },
  });
  const result = await response;
  await Promise.all(pending);
  return result;
}
const publicData =
  "https://project.supabase.co/storage/v1/object/public/data/example.json";
it("n’intercepte ni API privées, ni bucket métier, ni requêtes Range", async () => {
  for (const url of [
    "https://app.test/api/admin/accounts",
    "https://project.supabase.co/rest/v1/contacts",
    "https://project.supabase.co/storage/v1/object/public/contacts/data.json",
  ])
    expect(await dispatch(url)).toBeUndefined();
  expect(
    await dispatch(publicData, { headers: { Range: "bytes=0-10" } }),
  ).toBeUndefined();
  expect(await dispatch(publicData, { method: "POST" })).toBeUndefined();
  expect(storage.open).not.toHaveBeenCalled();
});
it("continue à servir le réseau quand le cache est inaccessible", async () => {
  storage.open.mockRejectedValue(new Error("storage denied"));
  expect((await dispatch(publicData))?.status).toBe(200);
});
it("une erreur de quota n’annule pas une réponse réussie", async () => {
  cache.put.mockRejectedValue(new Error("quota"));
  expect((await dispatch(publicData))?.status).toBe(200);
});
it("ne stocke pas de données de taille inconnue, volumineuses ou compressées", async () => {
  for (const headers of <Record<string, string>[]>[
    {},
    { "content-length": "999999" },
    { "content-length": "11", "content-encoding": "gzip" },
  ]) {
    network.mockResolvedValueOnce(new Response("data", { headers }));
    await dispatch(publicData);
  }
  expect(cache.put).not.toHaveBeenCalled();
});
it("limite le cache à 120 entrées après insertion", async () => {
  cache.keys.mockResolvedValue(
    Array.from({ length: 123 }, (_, i) => `key-${i}`),
  );
  await dispatch(publicData);
  expect(cache.delete.mock.calls).toEqual([["key-0"], ["key-1"], ["key-2"]]);
});
