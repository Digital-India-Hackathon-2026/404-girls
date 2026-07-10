const https = require('https');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = [
  {
    url: 'https://raw.githubusercontent.com/microsoft/playwright/master/tests/assets/video/single-frame.y4m',
    name: 'barcode.y4m'
  }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error('Failed to download ' + url));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

(async () => {
  for (const f of files) {
    const dest = path.join(outDir, f.name);
    if (fs.existsSync(dest)) {
      console.log(dest, 'exists - skipping');
      continue;
    }
    console.log('Downloading', f.url, '→', dest);
    try {
      await download(f.url, dest);
      console.log('Saved', dest);
    } catch (e) {
      console.error('Failed to download', f.url, e.message || e);
    }
  }
})();
