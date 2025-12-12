import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Root of the monorepo (parent of members/)
// Used as cwd for emulator commands which need access to firebase.json and functions/
const rootDirectory = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  testDir: './tests',
  // Run tests serially since they share emulator state
  // Parallel execution would cause race conditions when clearing/seeding test data
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1, // Single worker to avoid emulator state conflicts between tests
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

  webServer: [
    {
      command: 'bun run emulators:e2e',
      cwd: rootDirectory,
      url: 'http://localhost:9099', // Auth emulator health check
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
    {
      // Only start Angular - emulators are started above
      // Using 'bun run start' would start emulators twice causing port conflicts
      // angular:start script is in root package.json and handles 'cd members' internally
      command: 'bun run angular:start',
      cwd: rootDirectory,
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
