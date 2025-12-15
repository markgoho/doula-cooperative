import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Root of the monorepo (parent of members/)
const rootDirectory = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  testDir: './tests',
  // Tests can run in parallel - each test mocks its own API responses
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  ...(process.env['CI'] && { workers: 2 }),
  reporter: [['html', { outputFolder: '../playwright-report', open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start Angular dev server and Auth emulator
  // - Angular connects to Auth emulator for real authentication
  // - API calls are mocked via Playwright page.route()
  // - --configuration=e2e: Use empty proxy config so Playwright can intercept API calls
  webServer: [
    {
      // Firebase Auth emulator only (no Firestore, no Functions)
      // Uses seeded auth data from auth-export/ directory
      command: 'firebase emulators:start --only auth --import=./members/e2e/auth-export',
      cwd: rootDirectory,
      url: 'http://localhost:9099',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
    {
      // Angular dev server connecting to Auth emulator
      command: 'cd members && ng serve --configuration=e2e',
      cwd: rootDirectory,
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
