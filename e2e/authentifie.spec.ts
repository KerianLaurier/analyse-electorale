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

test("le briefing Suivre s'affiche avec ses cartes", async ({ page }) => {
  await login(page);
  await page.goto("/suivre");
  await expect(page.getByText("Briefing", { exact: true })).toBeVisible();
  await expect(page.getByText("Dernier sondage")).toBeVisible();
  await expect(page.getByText("Prochaine échéance")).toBeVisible();
});

test("créer puis supprimer une action dans le QG", async ({ page }) => {
  await login(page);
  await page.goto("/espace?tab=tasks");

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
