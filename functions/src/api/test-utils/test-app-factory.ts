import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createApp } from "../app.js";
import type { MemberDocument } from "../../types/member-document.js";
import type {
  MemberAdminService,
  AuthService,
} from "../services/service-interfaces.js";
import type { Logger } from "../handler.js";
import { createMockVerifyAdmin } from "./auth-mocks.js";

/**
 * Creates a test app with default mock services for admin endpoints.
 * Override specific methods by passing them in the overrides parameter.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured test app with mocked services
 */
export function createAdminTestApp(overrides?: {
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

  return createApp({
    memberAdminService: defaultMemberAdminService,
    authService: defaultAuthService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
