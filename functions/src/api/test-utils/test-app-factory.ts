import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { MemberDocument } from "../../types/member-document.js";
import { createAdminMembersPlugin } from "../plugins/admin-members-plugin.js";
import { createMembersPlugin } from "../plugins/members-plugin.js";
import type {
  AuthService,
  MemberAdminService,
  MemberService,
} from "../services/service-interfaces.js";
import type { Logger } from "../handler.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "./auth-mocks.js";

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

/**
 * @deprecated Use createAdminTestPlugin instead for isolated plugin testing.
 * This function is kept for backwards compatibility but creates unnecessary overhead.
 */
export const createAdminTestApp = createAdminTestPlugin;

/**
 * Creates the members plugin with default mock services for testing.
 * Tests only the members plugin in isolation - no full app composition needed.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured members plugin with mocked services
 */
export function createMembersTestPlugin(overrides?: {
  memberService?: Partial<MemberService>;
  authService?: Partial<AuthService>;
  logger?: Logger;
}) {
  const defaultMemberService: MemberService = {
    findById: mock(() => Promise.resolve({} as MemberDocument)),
    ...overrides?.memberService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: mock(() => Promise.resolve({} as DecodedIdToken)),
    verifyAdmin: createMockVerifyAdmin(),
    verifyOwnerOrAdmin: createMockVerifyOwnerOrAdmin(),
    ...overrides?.authService,
  };

  return createMembersPlugin({
    memberService: defaultMemberService,
    authService: defaultAuthService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
