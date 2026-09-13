import type { ErrorEvent } from "@sentry/nextjs";

/** Les traces de pile suffisent au diagnostic ; les contenus métier restent locaux. */
export function redactTelemetry(event: ErrorEvent): ErrorEvent {
  const clean = { ...event };
  delete clean.user;
  delete clean.extra;
  delete clean.contexts;
  delete clean.breadcrumbs;
  delete clean.message;
  delete clean.logentry;
  delete clean.request;
  delete clean.tags;
  if (clean.exception?.values) {
    clean.exception = {
      values: clean.exception.values.map((exception) => ({
        type: exception.type,
        value: "Message masqué pour protéger les données du compte",
        stacktrace: exception.stacktrace
          ? {
              frames: exception.stacktrace.frames?.map((frame) => ({
                filename: frame.filename?.split(/[?#]/)[0],
                function: frame.function,
                lineno: frame.lineno,
                colno: frame.colno,
                in_app: frame.in_app,
              })),
            }
          : undefined,
      })),
    };
  }
  return clean;
}
