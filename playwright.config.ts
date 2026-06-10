import { defineConfig } from "@playwright/test";

/**
 * Tests E2E (Playwright) — deux suites :
 *  - e2e/public.spec.ts : parcours sans compte (landing, gating, erreurs auth
 *    en français). Tourne partout, y compris sans vraie instance Supabase.
 *  - e2e/authentifie.spec.ts : parcours connectés (Explorer, Briefing, QG).
 *    Nécessite un compte de test : E2E_EMAIL / E2E_PASSWORD (+ les variables
 *    NEXT_PUBLIC_SUPABASE_* réelles) — ignorée sinon.
 *
 * `npm run test:e2e` (les tests unitaires restent sur `npm test` / Vitest).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // Valeurs factices par défaut : suffisantes pour démarrer le serveur et
      // dérouler la suite publique (l'auth échoue alors proprement, en français).
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    },
  },
});
