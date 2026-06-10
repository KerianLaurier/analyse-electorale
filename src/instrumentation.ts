import * as Sentry from "@sentry/nextjs";

/**
 * Suivi d'erreurs côté serveur & edge (Sentry). Même logique que le client :
 * actif uniquement quand NEXT_PUBLIC_SENTRY_DSN est défini. `onRequestError`
 * capture les erreurs des Server Components, route handlers et middleware.
 */
export async function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
