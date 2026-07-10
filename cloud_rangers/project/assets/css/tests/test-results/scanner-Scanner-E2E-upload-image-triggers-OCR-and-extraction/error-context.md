# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scanner.spec.js >> Scanner E2E >> upload image triggers OCR and extraction
- Location: scanner.spec.js:16:3

# Error details

```
Error: ENOENT: no such file or directory, stat 'C:\Users\DELL\innovation internship\404-girls\cloud_rangers\project\final_application\frontend\tests\assets\label1.jpg'
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "" [ref=e2] [cursor=pointer]:
    - /url: dashboard.html
    - generic [ref=e3]: 
  - generic [ref=e4]:
    - heading "Scan Barcode" [level=2] [ref=e5]
    - paragraph [ref=e6]: Align the barcode within the frame to scan automatically
    - generic [ref=e9]:
      - generic [ref=e10]: 
      - text: No camera found
    - generic [ref=e11]:
      - textbox "Enter barcode manually..." [ref=e12]
      - button "Search" [ref=e13] [cursor=pointer]
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | test.beforeEach(async ({ page }) => {
  4  |   await page.addInitScript(() => {
  5  |     localStorage.setItem('isLoggedIn', 'true');
  6  |   });
  7  | });
  8  | 
  9  | test.describe('Scanner E2E', () => {
  10 |   test('loads scanner page and shows the scanner UI', async ({ page }) => {
  11 |     await page.goto('/barcodescanner.html');
  12 |     await expect(page.locator('#video')).toBeVisible({ timeout: 20000 });
  13 |     await expect(page.locator('#status')).toHaveText(/camera/i, { timeout: 20000 });
  14 |   });
  15 | 
  16 |   test('upload image triggers OCR and extraction', async ({ page }) => {
  17 |     await page.goto('/barcodescanner.html');
> 18 |     await page.setInputFiles('#uploadImage', 'assets/label1.jpg');
     |     ^ Error: ENOENT: no such file or directory, stat 'C:\Users\DELL\innovation internship\404-girls\cloud_rangers\project\final_application\frontend\tests\assets\label1.jpg'
  19 | 
  20 |     const ocrConsole = await page.waitForEvent('console', {
  21 |       predicate: (message) => message.text().includes('Product result') || message.text().toLowerCase().includes('ocr'),
  22 |       timeout: 30000,
  23 |     });
  24 | 
  25 |     expect(ocrConsole).toBeTruthy();
  26 |   });
  27 | });
  28 | 
```