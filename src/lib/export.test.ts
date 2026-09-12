import { describe, expect, it } from "vitest";
import { buildCsv } from "./export";

describe("export CSV", () => {
  it.each(["=1+1", "+123", "-1+2", "@SUM(A1)", "  =1+1", "\t=1+1", "\r=1+1"])("neutralise la formule issue d'une chaîne %j", (value) => {
    const cell = buildCsv([{ valeur: value }]).split("\r\n").slice(1).join("\r\n");
    expect(cell.replace(/^"/, "").startsWith("'")).toBe(true);
  });
  it("conserve les nombres et échappe les séparateurs et guillemets", () => {
    expect(buildCsv([{ nombre: -1.5, nom: 'a;"b"' }])).toBe('nombre;nom\r\n-1,5;"a;""b"""');
  });
  it("neutralise aussi un en-tête contrôlé par l'utilisateur", () => {
    expect(buildCsv([{ "=1+1": "valeur" }])).toBe("'=1+1\r\nvaleur");
  });
});
