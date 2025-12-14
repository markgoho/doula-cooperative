import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { MemberDocument } from "../../types/member-document.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { createMembersPlugin } from "../plugins/members-plugin.js";
import type { AuthService } from "../services/auth/interface.js";
import type { MemberService } from "../services/member/interface.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "./auth-mocks.js";

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
