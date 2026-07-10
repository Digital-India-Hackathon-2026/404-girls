const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });
});

test.describe('Scanner E2E', () => {
  test('loads scanner page and shows the scanner UI', async ({ page }) => {
    await page.goto('/barcodescanner.html');
    await expect(page.locator('#video')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#status')).toHaveText(/camera/i, { timeout: 20000 });
  });

  test('upload image triggers OCR and extraction', async ({ page }) => {
    await page.goto('/barcodescanner.html');
    await page.setInputFiles('#uploadImage', 'assets/label1.jpg');

    const ocrConsole = await page.waitForEvent('console', {
      predicate: (message) => message.text().includes('Product result') || message.text().toLowerCase().includes('ocr'),
      timeout: 30000,
    });

    expect(ocrConsole).toBeTruthy();
  });
});
