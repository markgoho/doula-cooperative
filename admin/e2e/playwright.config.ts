import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Root of the monorepo (parent of admin/)
const rootDirectory = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  ...(process.env['CI'] && { workers: 2 }),
  reporter: [['html', { outputFolder: '../playwright-report', open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4201',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'firebase emulators:start --only auth --import=./admin/e2e/auth-export',
      cwd: rootDirectory,
      url: 'http://localhost:9099',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
    {
      command: 'cd admin && ng serve --port 4201 --configuration=e2e',
      cwd: rootDirectory,
      url: 'http://localhost:4201',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
