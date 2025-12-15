import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";
import { createAdminUnclaimedProfilesPlugin } from "../plugins/admin-unclaimed-profiles-plugin.js";
import type { UnclaimedProfileResponse } from "../schemas/unclaimed-profile-schemas.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

/**
 * Creates the admin-unclaimed-profiles plugin with default mock services for testing.
 * Tests only the admin-unclaimed-profiles plugin in isolation - no full app composition needed.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured admin-unclaimed-profiles plugin with mocked services
 */
export function createAdminTestPlugin(overrides?: {
  unclaimedProfileAdminService?: Partial<UnclaimedProfileAdminService>;
  authService?: Partial<AuthService>;
  logger?: Logger;
}) {
  const defaultUnclaimedProfileAdminService: UnclaimedProfileAdminService = {
    listUnclaimedProfiles: mock(() =>
      Promise.resolve({
        profiles: [] as UnclaimedProfileResponse[],
        total: 0,
      }),
    ),
    getUnclaimedProfile: mock(() =>
      Promise.resolve({} as UnclaimedProfileResponse),
    ),
    ...overrides?.unclaimedProfileAdminService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: mock(() => Promise.resolve({} as DecodedIdToken)),
    verifyAdmin: createMockVerifyAdmin(),
    verifyOwnerOrAdmin: createMockVerifyOwnerOrAdmin(),
    ...overrides?.authService,
  };

  return createAdminUnclaimedProfilesPlugin({
    unclaimedProfileAdminService: defaultUnclaimedProfileAdminService,
    authService: defaultAuthService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
