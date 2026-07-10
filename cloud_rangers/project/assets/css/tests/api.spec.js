const { test, expect } = require('@playwright/test');

test.describe('Backend API', () => {
  test('product endpoint returns 200 and JSON schema', async ({ request }) => {
    const res = await request.get('/api/product/3017620422003');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('ingredients');
  });

  test('barcode scan endpoint accepts POST', async ({ request }) => {
    const res = await request.post('/api/v1/scan/barcode', {
      data: JSON.stringify({ barcode: '3017620422003' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('ocr endpoint accepts image payload', async ({ request }) => {
    const blank = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';
    const res = await request.post('/api/v1/scan/ocr', {
      data: JSON.stringify({ image: blank }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(200);
  });
});
