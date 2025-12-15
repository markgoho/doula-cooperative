#!/usr/bin/env bash
set -e

# Kill any existing Firebase emulators to avoid port conflicts
# This ensures a clean slate when running tests after manual emulator usage
echo "Stopping any running Firebase emulators..."
pkill -f 'firebase emulators' 2>/dev/null || true

# Wait for Auth emulator port to be released
# Only Auth emulator is needed - all API requests are mocked via Playwright route interception
echo "Waiting for Auth emulator port to be released..."
port=9099
max_wait=5
elapsed=0
while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; do
  if [ $elapsed -ge $max_wait ]; then
    echo "ERROR: Port $port is still in use after ${max_wait}s. Please manually stop the process using this port."
    echo "You can find the process with: lsof -i :$port"
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done
echo "Auth emulator port is available."

# Run Playwright tests (which starts Auth emulator and dev server via webServer config)
echo "Running E2E tests..."
playwright test --config=e2e/playwright.config.ts "$@"
