import { test, expect, type Page } from "@playwright/test";

/**
 * Parcours connectés — nécessite un compte de test (avec abonnement actif ou
 * essai en cours) : E2E_EMAIL / E2E_PASSWORD + NEXT_PUBLIC_SUPABASE_* réels.
 * Suite ignorée quand ces variables manquent (dev local sans secrets, CI).
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(!EMAIL || !PASSWORD, "E2E_EMAIL / E2E_PASSWORD non définis");

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel("E-mail professionnel").fill(EMAIL ?? "");
  await page.getByLabel(/mot de passe/i).fill(PASSWORD ?? "");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/explorer/);
}

test("l'explorateur charge la carte et ses contrôles", async ({ page }) => {
  await login(page);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  // Le rail de navigation applicatif est présent et Explorer est actif.
  await expect(
    page.getByRole("navigation", { name: "Sections principales" }).getByRole("link", { name: "Explorer" }).first(),
  ).toHaveAttribute("aria-current", "page");
});

test("les anciens liens ?tab= redirigent vers les nouvelles sections du QG", async ({ page }) => {
  await login(page);
  // Liens partagés / mis en favori du temps où le QG tenait en une route à
  // dix onglets (cf. LEGACY_TAB_REDIRECTS).
  await page.goto("/espace?tab=canvass");
  await expect(page).toHaveURL(/\/espace\/terrain\?vue=porte-a-porte$/);
  await page.goto("/espace?tab=campaign");
  await expect(page).toHaveURL(/\/espace\/plan\?vue=campagne$/);
});

test("la navigation du QG expose les 4 sections", async ({ page }) => {
  await login(page);
  await page.goto("/espace");
  const nav = page.getByRole("navigation", { name: "Sections du QG" });
  for (const label of ["Aujourd’hui", "Le plan", "Le terrain", "L’équipe"]) {
    await expect(nav.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: /Aujourd’hui/ })).toHaveAttribute("aria-current", "page");
});

test("créer puis supprimer une action dans le QG", async ({ page }) => {
  await login(page);
  await page.goto("/espace/terrain?vue=actions");

  const titre = `[E2E] Tract gare — ${Date.now()}`;
  await page.getByRole("button", { name: "Nouvelle action" }).click();
  await page.getByPlaceholder(/Que faut-il faire/).fill(titre);
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText(titre)).toBeVisible();

  // Nettoyage par l'UI : menu Options de la ligne créée → Supprimer.
  const ligne = page.locator("div", { hasText: titre }).filter({ has: page.getByLabel("Options") }).last();
  await ligne.getByLabel("Options").click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await expect(page.getByText(titre)).toHaveCount(0);
});

test("Analyser : le périmètre suit d'une lentille à l'autre", async ({ page }) => {
  await login(page);
  // Défaut : la France (le national n'est plus un outil à part).
  await page.goto("/analyser");
  await expect(page.getByRole("heading", { name: "France entière" })).toBeVisible();

  const lentilles = page.getByRole("navigation", { name: "Lentilles d’analyse" });
  for (const label of ["Diagnostic", "Historique", "Sociologie", "Ciblage", "Projection"]) {
    await expect(lentilles.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }

  // Un périmètre posé dans l'URL est conservé en changeant de lentille.
  await page.goto("/analyser?t=commune&c=59350&l=Lille");
  await expect(page.getByRole("heading", { name: "Lille" })).toBeVisible();
  await lentilles.getByRole("link", { name: /Historique/ }).click();
  await expect(page).toHaveURL(/\/analyser\/historique\?t=commune&c=59350&l=Lille$/);
  await expect(page.getByRole("heading", { name: "Lille" })).toBeVisible();
});

test("Analyser : les anciennes URL d'outils redirigent vers leur lentille", async ({ page }) => {
  await login(page);
  await page.goto("/analyser/marginalite");
  await expect(page).toHaveURL(/\/analyser\/ciblage$/);
  // Le périmètre éventuel est préservé au passage.
  await page.goto("/analyser/comparateur?t=commune&c=59350&l=Lille");
  await expect(page).toHaveURL(/\/analyser\/historique\?t=commune&c=59350&l=Lille$/);
});
