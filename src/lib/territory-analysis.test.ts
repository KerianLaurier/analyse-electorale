import { afterEach, describe, expect, it, vi } from "vitest";
import { loadJson } from "./territory-analysis";

afterEach(() => vi.unstubAllGlobals());

describe("cache des données territoriales", () => {
  it("partage une requête réussie entre les appelants", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ value: 42 }));
    vi.stubGlobal("fetch", fetch);
    expect(await Promise.all([loadJson("/success.json"), loadJson("/success.json")])).toEqual([{ value: 42 }, { value: 42 }]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("un fichier absent peut être publié et relu ensuite", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json([1]));
    vi.stubGlobal("fetch", fetch);
    expect(await loadJson("/missing.json")).toBeNull();
    expect(await loadJson("/missing.json")).toEqual([1]);
  });
  it("une erreur HTTP remonte à Query et reste rejouable", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(Response.json([1]));
    vi.stubGlobal("fetch", fetch);
    await expect(loadJson("/unavailable.json")).rejects.toThrow("503");
    expect(await loadJson("/unavailable.json")).toEqual([1]);
  });
  it("une panne réseau ne devient pas une absence de données définitive", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json([1]));
    vi.stubGlobal("fetch", fetch);
    await expect(loadJson("/network.json")).rejects.toThrow("offline");
    expect(await loadJson("/network.json")).toEqual([1]);
  });
  it("un JSON corrompu ne reste pas mémorisé", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("invalid")).mockResolvedValueOnce(Response.json([1]));
    vi.stubGlobal("fetch", fetch);
    await expect(loadJson("/corrupted.json")).rejects.toThrow();
    expect(await loadJson("/corrupted.json")).toEqual([1]);
  });
});
