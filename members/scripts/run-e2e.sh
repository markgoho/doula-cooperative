#!/usr/bin/env bash
set -e

# Kill any existing Firebase emulators to avoid port conflicts
# This ensures a clean slate when running tests after manual emulator usage
echo "Stopping any running Firebase emulators..."
pkill -f 'firebase emulators' 2>/dev/null || true
pkill -f 'cloud-firestore-emulator' 2>/dev/null || true

# Wait for ports to be released and verify they're available
# Check the three main emulator ports: Auth (9099), Firestore (8080), Functions (5001)
echo "Waiting for emulator ports to be released..."
for port in 9099 8080 5001; do
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
done
echo "All emulator ports are available."

# Build functions (emulators need transpiled JS)
echo "Building functions..."
if ! bun run --cwd ../functions build; then
  echo "ERROR: Failed to build functions. Fix TypeScript errors before running e2e tests."
  echo "Check the output above for compilation errors."
  exit 1
fi
echo "Functions built successfully."

# Run Playwright tests (which starts emulators and dev server via webServer config)
echo "Running E2E tests..."
playwright test --config=e2e/playwright.config.ts "$@"
