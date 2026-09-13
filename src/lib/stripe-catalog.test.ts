import { expect, it } from "vitest";
import { validateCatalogPrice } from "./stripe-catalog";
const price = {
  currency: "eur",
  unit_amount: 4900,
  recurring: { interval: "month", interval_count: 1 },
};
it("accepte le montant vendu et affiché", () =>
  expect(() =>
    validateCatalogPrice(price, "candidat", "monthly"),
  ).not.toThrow());
it.each([
  { ...price, unit_amount: 9900 },
  { ...price, currency: "usd" },
  { ...price, recurring: { interval: "year", interval_count: 1 } },
])("bloque un catalogue incohérent", (value) =>
  expect(() => validateCatalogPrice(value, "candidat", "monthly")).toThrow(
    /catalogue/,
  ),
);
