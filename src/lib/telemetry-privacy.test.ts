import { expect, it } from "vitest";
import { redactTelemetry } from "./telemetry-privacy";
it("conserve la localisation du bug sans transmettre les contenus métier", () => {
  const event = redactTelemetry({
    type: undefined,
    user: { email: "person@example.test" },
    extra: { body: "privé" },
    request: { url: "https://test?token=secret" },
    breadcrumbs: [{ message: "privé" }],
    exception: {
      values: [
        {
          type: "Error",
          value: "person@example.test privé",
          stacktrace: {
            frames: [
              {
                filename: "app.js?token=secret",
                lineno: 42,
                vars: { secret: "privé" },
              },
            ],
          },
        },
      ],
    },
  });
  expect(JSON.stringify(event)).not.toMatch(/privé|secret|person@example/);
  expect(event.exception?.values?.[0].stacktrace?.frames?.[0]).toMatchObject({
    filename: "app.js",
    lineno: 42,
  });
});
