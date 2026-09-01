import { test, expect } from "@playwright/test";

/**
 * Parcours publics — aucun compte requis. Vérifie les fondamentaux qui, s'ils
 * régressent, bloquent 100 % des utilisateurs : landing, gating d'accès,
 * formulaires d'auth et messages d'erreur en français.
 */

test("la landing s'affiche en mode pré-lancement", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/intelligence électorale/i);
  // Pré-lancement : le CTA mène à la liste d'attente, plus à l'essai gratuit.
  await expect(page.getByRole("link", { name: /liste d'attente/i }).first()).toBeVisible();
  // La section Tarifs a été retirée (les prix ne sont pas encore publics).
  await expect(page.locator("#tarifs")).toHaveCount(0);
  await expect(page.locator("#bientot")).toBeVisible();
});

test("la liste d'attente accepte une adresse et répond", async ({ page }) => {
  await page.goto("/#bientot");

  const section = page.locator("#bientot");
  await expect(section.getByRole("heading", { name: /la plateforme ouvre bientôt/i })).toBeVisible();
  // Mention RGPD obligatoire : la base légale de la collecte est le consentement.
  await expect(section.getByText(/politique de confidentialité/i)).toBeVisible();

  const champ = section.getByPlaceholder("vous@organisation.fr");
  await expect(champ).toBeVisible();
  await champ.fill("e2e@exemple.fr");
  await section.getByRole("button", { name: /être prévenu/i }).click();

  // Le back-end n'est pas garanti configuré en CI (SUPABASE_SERVICE_ROLE_KEY
  // absente → 503). On vérifie donc que la boucle client → API → UI aboutit à
  // un retour explicite, succès comme repli, plutôt qu'à un formulaire figé.
  await expect(
    section.getByText(/c'est noté|indisponible|impossible/i).first(),
  ).toBeVisible();
});

test("les routes applicatives exigent une connexion", async ({ page }) => {
  await page.goto("/explorer");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fexplorer/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

  await page.goto("/espace");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fespace/);
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

test("l'écran mot de passe oublié s'affiche, l'inscription renvoie à la liste d'attente", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Oublié ?" }).click();
  await expect(page.getByRole("heading", { name: "Mot de passe oublié" })).toBeVisible();

  // Pré-lancement : plus de création de compte depuis la connexion — le lien
  // mène à la liste d'attente de la landing.
  await page.goto("/auth/login");
  await page.getByRole("link", { name: /liste d'attente/i }).click();
  await expect(page).toHaveURL(/\/#bientot$/);
  await expect(page.locator("#bientot")).toBeVisible();

  // Et l'URL directe est redirigée par le proxy (aucun formulaire d'essai).
  await page.goto("/auth/signup");
  await expect(page).toHaveURL(/\/#bientot$/);
  await expect(page.getByRole("heading", { name: "Démarrer l'essai gratuit" })).toHaveCount(0);
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

test("la page abonnement n'est plus publique en pré-lancement", async ({ page }) => {
  // Les formules (et leurs prix) ne sont pas publiées avant l'ouverture :
  // un visiteur anonyme est renvoyé vers la connexion.
  await page.goto("/auth/abonnement");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fauth%2Fabonnement/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
});
