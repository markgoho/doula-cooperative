import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";
import { createAdminMatchRequestsPlugin } from "../plugins/admin-match-requests-plugin.js";
import type { MatchRequestResponse } from "../schemas/match-request-schemas.js";
import type { MatchRequestAdminService } from "../services/interface.js";

/**
 * Creates the admin-match-requests plugin with default mock services for testing.
 * Tests only the admin-match-requests plugin in isolation - no full app composition needed.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured admin-match-requests plugin with mocked services
 */
export function createAdminTestPlugin(overrides?: {
  matchRequestAdminService?: Partial<MatchRequestAdminService>;
  authService?: Partial<AuthService>;
  logger?: Logger;
}) {
  const defaultMatchRequestAdminService: MatchRequestAdminService = {
    listMatchRequests: mock(() =>
      Promise.resolve({
        requests: [] as MatchRequestResponse[],
        total: 0,
        pendingCount: 0,
        processedCount: 0,
      }),
    ),
    getMatchRequest: mock(() => Promise.resolve({} as MatchRequestResponse)),
    updateMatchRequest: mock(() => Promise.resolve({ success: true as const })),
    ...overrides?.matchRequestAdminService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: mock(() => Promise.resolve({} as DecodedIdToken)),
    verifyAdmin: createMockVerifyAdmin(),
    verifyOwnerOrAdmin: createMockVerifyOwnerOrAdmin(),
    ...overrides?.authService,
  };

  return createAdminMatchRequestsPlugin({
    matchRequestAdminService: defaultMatchRequestAdminService,
    authService: defaultAuthService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
