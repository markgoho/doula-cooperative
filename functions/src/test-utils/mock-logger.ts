import type { Logger } from "../shared-api/types/logger.js";

/**
 * Creates a silent mock logger for tests that need a Logger dependency
 * but don't need to make assertions about logging behavior.
 *
 * For tests that need to verify logging behavior, create your own mock
 * using bun:test's `mock()` function.
 */
export function createMockLogger(): Logger {
  return {
    error: () => {
      // Silent mock
    },
    warn: () => {
      // Silent mock
    },
    info: () => {
      // Silent mock
    },
    debug: () => {
      // Silent mock
    },
    log: () => {
      // Silent mock
    },
  };
}
