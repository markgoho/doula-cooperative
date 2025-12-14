import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { MemberDocument } from "../../types/member-document.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { createAdminMembersPlugin } from "../plugins/admin-members-plugin.js";
import type { MemberAdminService } from "../services/admin-member/interface.js";
import type { AuthService } from "../services/auth/interface.js";
import { createMockVerifyAdmin } from "./auth-mocks.js";

/**
 * Creates the admin-members plugin with default mock services for testing.
 * Tests only the admin plugin in isolation - no full app composition needed.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured admin plugin with mocked services
 */
export function createAdminTestPlugin(overrides?: {
  memberAdminService?: Partial<MemberAdminService>;
  authService?: Partial<AuthService>;
  logger?: Logger;
}) {
  const defaultMemberAdminService: MemberAdminService = {
    verifyMemberExists: mock(() => Promise.resolve({} as MemberDocument)),
    listMembers: mock(() => Promise.resolve({ members: [], total: 0 })),
    updateMember: mock(() => Promise.resolve({} as MemberDocument)),
    activateMembership: mock(() => Promise.resolve({} as MemberDocument)),
    deactivateMembership: mock(() => Promise.resolve({} as MemberDocument)),
    extendMembership: mock(() => Promise.resolve({} as MemberDocument)),
    deleteUser: mock(() => Promise.resolve()),
    ...overrides?.memberAdminService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: mock(() => Promise.resolve({} as DecodedIdToken)),
    verifyAdmin: createMockVerifyAdmin(),
    verifyOwnerOrAdmin: mock(() => Promise.resolve({} as DecodedIdToken)),
    ...overrides?.authService,
  };

  return createAdminMembersPlugin({
    memberAdminService: defaultMemberAdminService,
    authService: defaultAuthService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
