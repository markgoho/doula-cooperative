import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";
import { createAdminSettingsPlugin } from "../plugins/admin-settings-plugin.js";

/**
 * Creates the admin-settings plugin with default mock services for testing.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured admin-settings plugin with mocked services
 */
export function createAdminSettingsTestPlugin(overrides?: {
  referralPortalSettingsService?: Partial<ReferralPortalSettingsService>;
  authService?: Partial<AuthService>;
  logger?: Logger;
}) {
  const defaultReferralPortalSettingsService: ReferralPortalSettingsService = {
    getReferralPortalSettings: mock(() =>
      Promise.resolve({ v2Enabled: false }),
    ),
    updateReferralPortalSettings: mock(
      (options: { v2Enabled: boolean; updatedBy: string }) =>
        Promise.resolve({
          ...options,
          updatedAt: "2026-11-22T12:00:00.000Z",
        }),
    ),
    ...overrides?.referralPortalSettingsService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: mock(() => Promise.resolve({} as DecodedIdToken)),
    verifyAdmin: createMockVerifyAdmin(),
    verifyOwnerOrAdmin: createMockVerifyOwnerOrAdmin(),
    ...overrides?.authService,
  };

  return createAdminSettingsPlugin({
    referralPortalSettingsService: defaultReferralPortalSettingsService,
    authService: defaultAuthService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
