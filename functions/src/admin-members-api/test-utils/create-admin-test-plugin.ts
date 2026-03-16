import type { ProfileDocument } from "@doula-coop/functions-shared/collections/index.js";
import type { AuthService } from "@doula-coop/functions-shared/shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "@doula-coop/functions-shared/test-utils/auth-mocks.js";
import type { MemberDocument } from "@doula-coop/functions-shared/types/member-document.js";
import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createAdminMembersPlugin } from "../plugins/admin-members-plugin.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Creates the admin-members plugin with default mock services for testing.
 * Tests only the admin-members plugin in isolation - no full app composition needed.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured admin-members plugin with mocked services
 */
export function createAdminTestPlugin(overrides?: {
  memberAdminService?: Partial<MemberAdminService>;
  authService?: Partial<AuthService>;
  emailService?: Partial<EmailServiceInterface>;
  logger?: Logger;
}) {
  const defaultMemberAdminService: MemberAdminService = {
    listMembers: mock(() =>
      Promise.resolve({ members: [] as MemberDocument[], total: 0 }),
    ),
    updateMember: mock(() => Promise.resolve({} as MemberDocument)),
    activateMembership: mock(() => Promise.resolve({} as MemberDocument)),
    cancelMembership: mock(() => Promise.resolve({} as MemberDocument)),
    extendMembership: mock(() => Promise.resolve({} as MemberDocument)),
    updateClaims: mock(
      (options: {
        uid: string;
        claims: { admin?: boolean };
        requestingAdminUid: string;
        logger: Logger;
      }) => {
        if (
          options.uid === options.requestingAdminUid &&
          options.claims.admin !== undefined
        ) {
          return Promise.reject(
            new Error("Cannot modify your own admin privileges"),
          );
        }
        return Promise.resolve();
      },
    ),
    verifyMemberExists: mock(() => Promise.resolve({} as MemberDocument)),
    isAdmin: mock(() => Promise.resolve(false)),
    refundMembership: mock(() =>
      Promise.resolve({
        member: {} as MemberDocument,
        stripeRefundCreated: true,
        subscriptionCanceled: true,
        refundActions: {
          memberDeactivated: true,
        },
      }),
    ),
    cleanSlateDelete: mock(() =>
      Promise.resolve({
        deletedUid: "test-member-id",
        memberDocumentDeleted: true,
        authUserDeleted: true,
      }),
    ),
    toggleProfileDraft: mock(() =>
      Promise.resolve({
        slug: "test-slug",
        draft: false,
        hugoRebuildTriggered: true,
      }),
    ),
    readProfile: mock(() =>
      Promise.resolve({
        slug: "test-slug",
        profile: {
          title: "Test Doula",
          bio: "Test bio content",
          draft: false,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        } as ProfileDocument,
      }),
    ),
    listUnlinkedProfiles: mock(() =>
      Promise.resolve({
        profiles: [],
      }),
    ),
    linkProfile: mock(() =>
      Promise.resolve({
        member: {} as MemberDocument,
      }),
    ),
    ...overrides?.memberAdminService,
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

  return createAdminMembersPlugin({
    memberAdminService: defaultMemberAdminService,
    authService: defaultAuthService,
    emailService: defaultEmailService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
