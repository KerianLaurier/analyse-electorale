import { expect, it } from "vitest";
import { readBoundedJson } from "./request-json";
it("lit une petite requête JSON", async () =>
  expect(
    await readBoundedJson(
      new Request("https://test.local", {
        method: "POST",
        body: '{"email":"a@b.fr"}',
      }),
    ),
  ).toEqual({ email: "a@b.fr" }));
it("refuse un corps trop gros sans Content-Length", async () => {
  await expect(
    readBoundedJson(
      new Request("https://test.local", {
        method: "POST",
        body: "a".repeat(4097),
      }),
    ),
  ).rejects.toMatchObject({ status: 413 });
});
it("refuse le JSON invalide", async () => {
  await expect(
    readBoundedJson(
      new Request("https://test.local", { method: "POST", body: "{" }),
    ),
  ).rejects.toMatchObject({ status: 400 });
});
