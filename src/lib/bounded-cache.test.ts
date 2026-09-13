import { afterEach, expect, it, vi } from "vitest";
import { BoundedCache } from "./bounded-cache";
afterEach(() => vi.useRealTimers());
it("évince l'entrée la moins récemment consultée", () => {
  const cache = new BoundedCache<string, number>(2);
  cache.set("a", 1).set("b", 2);
  cache.get("a");
  cache.set("c", 3);
  expect(cache.size).toBe(2);
  expect(cache.get("b")).toBeUndefined();
  expect(cache.get("a")).toBe(1);
});
it("expire même une entrée régulièrement consultée", () => {
  vi.useFakeTimers();
  const cache = new BoundedCache<string, number>(2, 100);
  cache.set("a", 1);
  vi.advanceTimersByTime(99);
  expect(cache.get("a")).toBe(1);
  vi.advanceTimersByTime(1);
  expect(cache.get("a")).toBeUndefined();
});
