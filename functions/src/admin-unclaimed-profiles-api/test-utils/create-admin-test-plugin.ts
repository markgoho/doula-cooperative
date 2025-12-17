import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";
import { createAdminUnclaimedProfilesPlugin } from "../plugins/admin-unclaimed-profiles-plugin.js";
import type {
  UnclaimedProfileSuccessResponse,
  ListUnclaimedProfilesSuccessResponse,
  SendInvitationSuccessResponse,
} from "../schemas/unclaimed-profile-schemas.js";
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
  emailService?: EmailServiceInterface;
  logger?: Logger;
}) {
  const defaultUnclaimedProfileAdminService: UnclaimedProfileAdminService = {
    listUnclaimedProfiles: mock(() =>
      Promise.resolve({
        profiles: [],
        total: 0,
      } as ListUnclaimedProfilesSuccessResponse),
    ),
    getUnclaimedProfile: mock(() =>
      Promise.resolve({} as UnclaimedProfileSuccessResponse),
    ),
    sendInvitation: mock(() =>
      Promise.resolve({ success: true } as SendInvitationSuccessResponse),
    ),
    ...overrides?.unclaimedProfileAdminService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: mock(() => Promise.resolve({} as DecodedIdToken)),
    verifyAdmin: createMockVerifyAdmin(),
    verifyOwnerOrAdmin: createMockVerifyOwnerOrAdmin(),
    ...overrides?.authService,
  };

  const defaultEmailService: EmailServiceInterface = {
    sendEmail: mock(() => Promise.resolve()),
    ...overrides?.emailService,
  };

  return createAdminUnclaimedProfilesPlugin({
    unclaimedProfileAdminService: defaultUnclaimedProfileAdminService,
    authService: defaultAuthService,
    emailService: defaultEmailService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
