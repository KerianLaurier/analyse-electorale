import { test, expect } from "@playwright/test";

/**
 * Parcours publics — aucun compte requis. Vérifie les fondamentaux qui, s'ils
 * régressent, bloquent 100 % des utilisateurs : landing, gating d'accès,
 * formulaires d'auth et messages d'erreur en français.
 */

test("la landing s'affiche", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/intelligence électorale/i);
  await expect(page.getByRole("link", { name: /essai gratuit/i }).first()).toBeVisible();
});

test("les routes applicatives exigent une connexion", async ({ page }) => {
  await page.goto("/explorer");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fexplorer/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

  await page.goto("/suivre");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fsuivre/);
});

test("un échec de connexion affiche une erreur en français", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("E-mail professionnel").fill("test@exemple.fr");
  await page.getByLabel(/mot de passe/i).fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();

  // Selon l'environnement : identifiants refusés (vraie instance) ou réseau
  // indisponible (instance factice) — dans les deux cas, message en français.
  const erreur = page.locator("text=/incorrect|Connexion impossible/");
  await expect(erreur).toBeVisible();
  await expect(page.locator("text=Invalid login credentials")).toHaveCount(0);
});

test("les écrans inscription et mot de passe oublié s'affichent", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Oublié ?" }).click();
  await expect(page.getByRole("heading", { name: "Mot de passe oublié" })).toBeVisible();

  await page.goto("/auth/login");
  await page.getByRole("link", { name: /essai gratuit/i }).click();
  await expect(page.getByRole("heading", { name: "Démarrer l'essai gratuit" })).toBeVisible();
  await expect(page.getByLabel("Organisation")).toBeVisible();
  await expect(page.getByText(/sans carte bancaire/i)).toBeVisible();
});

test("la page de secours hors-ligne et le manifest PWA sont servis", async ({ page, request }) => {
  // Publique (précachée par le service worker, avec ou sans session).
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "Vous êtes hors ligne" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const json = await manifest.json();
  expect(json.display).toBe("standalone");
  expect(json.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  expect(json.shortcuts?.length).toBeGreaterThan(0);

  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(await sw.text()).toContain("mvc-sw-");
});

test("la page abonnement expose les formules au public", async ({ page }) => {
  await page.goto("/auth/abonnement");
  await expect(page.getByRole("heading", { name: /une formule pour chaque campagne/i })).toBeVisible();
  // Les trois formules et le sélecteur de cycle sont rendus.
  await expect(page.getByText("Solo", { exact: true })).toBeVisible();
  await expect(page.getByText("Équipe", { exact: true })).toBeVisible();
  await expect(page.getByText("Cabinet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /annuel/i })).toBeVisible();
  // Annuel par défaut → bascule mensuel : le prix Solo suit la grille.
  await expect(page.getByText("490 €")).toBeVisible();
  await page.getByRole("button", { name: "Mensuel", exact: true }).click();
  await expect(page.getByText("49 €", { exact: false }).first()).toBeVisible();
  // Visiteur non connecté : le CTA mène à l'inscription (essai), pas au paiement.
  await expect(page.getByRole("link", { name: /démarrer l'essai gratuit/i }).first()).toBeVisible();
});
