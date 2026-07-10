Playwright E2E tests for the barcode scanner

Setup
1. Install dependencies:

   npm install

2. Install Playwright browsers:

   npx playwright install chromium

3. Download sample assets (video + example label images):

   node download-assets.js

Running tests

Start backend locally (see project README). Then run:

   npm test

Notes
- The fake camera requires a Y4M video file at `tests/assets/barcode.y4m`. The `download-assets.js` attempts to download a small sample.
- For real-device validation, run the manual checklist provided after automated tests pass.
