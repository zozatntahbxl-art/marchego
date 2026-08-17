import { expect, test } from '@playwright/test';

test('la page d’accueil affiche MarchéGo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('body')).toContainText(/MarchéGo|marché/i);
});

test('les pages légales sont accessibles', async ({ page }) => {
  await page.goto('/legal/cgu');
  await expect(page.getByRole('heading', { name: /conditions générales/i })).toBeVisible();
  await page.goto('/legal/confidentialite');
  await expect(page.getByRole('heading', { name: /confidentialité/i })).toBeVisible();
});
