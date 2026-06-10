import * as Sentry from "@sentry/nextjs";

/**
 * Suivi d'erreurs côté navigateur (Sentry). Actif uniquement quand
 * NEXT_PUBLIC_SENTRY_DSN est défini (production Netlify) — no-op en dev,
 * preview et build local. Pas de PII ni de session replay (RGPD : données
 * de campagne sensibles).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Traces légères : assez pour voir les pages lentes, sans gonfler le quota.
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
