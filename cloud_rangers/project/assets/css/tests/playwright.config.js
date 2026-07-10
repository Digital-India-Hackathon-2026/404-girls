const path = require('path');

const testDir = __dirname;
const frontendDir = path.resolve(testDir, '..');
const backendDir = path.resolve(frontendDir, '../backend');
const pythonExe = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
const sampleVideo = process.env.SAMPLE_VIDEO || path.join(testDir, 'assets', 'barcode.y4m');
const serverPort = process.env.TEST_SERVER_PORT || '9000';
const backendCommand = `"${pythonExe}" "${path.join(backendDir, 'run.py')}"`;

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  timeout: 120000,
  testDir: './',
  use: {
    baseURL: `http://127.0.0.1:${serverPort}`,
    headless: true,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${sampleVideo}`
      ]
    }
  },
  webServer: {
    command: backendCommand,
    cwd: backendDir,
    url: `http://127.0.0.1:${serverPort}`,
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      LPS_SERVER: 'fastapi',
      LPS_HOST: '127.0.0.1',
      FASTAPI_PORT: serverPort,
      PYTHONUNBUFFERED: '1'
    }
  },
  reporter: [['html', { outputFolder: 'playwright-report' }]]
};
