import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/safe-redirect";

describe("safeInternalPath", () => {
  it("accepte un chemin interne absolu", () => {
    expect(safeInternalPath("/explorer")).toBe("/explorer");
    expect(safeInternalPath("/circo/5902?x=1#a")).toBe("/circo/5902?x=1#a");
    expect(safeInternalPath("/bienvenue")).toBe("/bienvenue");
  });

  it("rejette les redirections ouvertes vers un domaine tiers", () => {
    for (const evil of [
      "https://evil.com",
      "http://evil.com",
      "//evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
      "mailto:x@y.z",
      "explorer", // pas de slash de tête
      "",
    ]) {
      expect(safeInternalPath(evil)).toBe("/explorer");
    }
  });

  it("repli sur null / undefined et fallback personnalisable", () => {
    expect(safeInternalPath(null)).toBe("/explorer");
    expect(safeInternalPath(undefined)).toBe("/explorer");
    expect(safeInternalPath("//evil.com", "/bienvenue")).toBe("/bienvenue");
  });
});
