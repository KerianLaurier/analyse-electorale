// Captures du manifest PWA (montrées dans l'interface d'installation Chrome) :
//
//   E2E_EMAIL=… E2E_PASSWORD=… node scripts/pipeline/build-screenshots.mjs [base_url]
//
// Produit public/screenshots/explorer-wide.png (1280×800) et
// espace-narrow.png (390×844) depuis un compte connecté (le gating protège
// ces vues). Base par défaut : http://localhost:3000 (dev server lancé).
// À relancer quand l'UI change notablement ; les PNG sont versionnés.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
if (!EMAIL || !PASSWORD) {
  console.error("E2E_EMAIL / E2E_PASSWORD requis (compte avec accès).");
  process.exit(1);
}

const OUT = path.join(import.meta.dirname, "..", "..", "public", "screenshots");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ locale: "fr-FR", deviceScaleFactor: 1 });
  const page = await context.newPage();

  // Connexion (mêmes sélecteurs que la suite e2e).
  await page.goto(`${BASE}/auth/login`);
  await page.getByLabel("E-mail professionnel").fill(EMAIL);
  await page.getByLabel(/mot de passe/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/explorer/);

  // Explorer (desktop) : attendre la carte ET la fin du coloriage (le badge
  // « Mise à jour de la carte… » disparaît quand la choroplèthe est peinte).
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator(".maplibregl-canvas").waitFor({ timeout: 30_000 });
  await page
    .getByText(/Mise à jour de la carte/)
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(3_000); // rendu des tuiles de fond
  await page.screenshot({ path: path.join(OUT, "explorer-wide.png") });
  console.log("✚ screenshots/explorer-wide.png (1280×800)");

  // QG de campagne (mobile).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/espace`);
  await page.getByRole("main").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: path.join(OUT, "espace-narrow.png") });
  console.log("✚ screenshots/espace-narrow.png (390×844)");
} finally {
  await browser.close();
}
