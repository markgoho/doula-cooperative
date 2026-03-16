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
import { createMembersPlugin } from "../plugins/members-plugin.js";
import type { MemberService } from "../services/member/interface.js";
import type { NewsletterService } from "../services/newsletter/interface.js";
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

  return createMembersPlugin({
    memberService: defaultMemberService,
    newsletterService: defaultNewsletterService,
    authService: defaultAuthService,
    emailService: defaultEmailService,
    verifyEmailService: defaultVerifyEmailService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
