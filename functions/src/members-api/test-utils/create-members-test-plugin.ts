import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { MemberFirestoreService } from "../../shared-api/services/member-firestore/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createMembersPlugin } from "../plugins/members-plugin.js";
import type { MemberService } from "../services/member/interface.js";
import type { NewsletterService } from "../services/newsletter/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";
import type { VerifyEmailService } from "../services/verify-email/interface.js";

/**
 * Creates the members plugin with default mock services for testing.
 * Tests only the members plugin in isolation - no full app composition needed.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured members plugin with mocked services
 */
export function createMembersTestPlugin(overrides?: {
  memberService?: Partial<MemberService>;
  newsletterService?: Partial<NewsletterService>;
  authService?: Partial<AuthService>;
  emailService?: EmailServiceInterface;
  verifyEmailService?: Partial<VerifyEmailService>;
  memberFirestoreService?: Partial<MemberFirestoreService>;
  referralsService?: Partial<ReferralsService>;
  logger?: Logger;
}) {
  const defaultMemberService: MemberService = {
    findById: mock(() => Promise.resolve({} as MemberDocument)),
    updateName: mock(() => Promise.resolve({} as MemberDocument)),
    cancelMembership: mock(() => Promise.resolve({} as MemberDocument)),
    ...overrides?.memberService,
  };

  const defaultNewsletterService: NewsletterService = {
    updateNewsletterPreference: mock(() =>
      Promise.resolve({ subscribed: true }),
    ),
    ...overrides?.newsletterService,
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

  const defaultVerifyEmailService: VerifyEmailService = {
    markEmailVerified: mock(() => Promise.resolve()),
    ...overrides?.verifyEmailService,
  };

  const defaultMemberFirestoreService: MemberFirestoreService = {
    getMemberByUid: mock(() =>
      Promise.resolve({
        exists: true,
        data: () => ({ email: "test@example.com" }),
      } as unknown as DocumentSnapshot),
    ),
    memberExists: mock(() => Promise.resolve(true)),
    writeMember: mock(() => Promise.resolve()),
    updateMember: mock(() => Promise.resolve()),
    deleteMember: mock(() => Promise.resolve()),
    ...overrides?.memberFirestoreService,
  };

  const defaultReferralsService: ReferralsService = {
    listReferrals: mock((_logger) => Promise.resolve([])),
    getReferral: mock((_requestId, _logger) =>
      Promise.reject(new Error("getReferral not configured in test")),
    ),
    ...overrides?.referralsService,
  };

  return createMembersPlugin({
    memberService: defaultMemberService,
    newsletterService: defaultNewsletterService,
    authService: defaultAuthService,
    emailService: defaultEmailService,
    verifyEmailService: defaultVerifyEmailService,
    memberFirestoreService: defaultMemberFirestoreService,
    referralsService: defaultReferralsService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
