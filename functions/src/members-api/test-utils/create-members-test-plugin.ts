import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { MemberFirestoreService } from "../../shared-api/services/member-firestore/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  createMockVerifyAdmin,
  createMockVerifyOwnerOrAdmin,
} from "../../test-utils/auth-mocks.js";
import type { MemberDocument } from "../../types/member-document.js";
import { createMembersPlugin } from "../plugins/members-plugin.js";
import type { MemberService } from "../services/member/interface.js";
import type { NewsletterService } from "../services/newsletter/interface.js";
import type { OfflineResponseService } from "../services/offline-response/interface.js";
import type { OutreachService } from "../services/outreach/interface.js";
import type { ReferralOutcomeService } from "../services/referral-outcome/interface.js";
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
  referralPortalSettingsService?: Partial<ReferralPortalSettingsService>;
  outreachService?: Partial<OutreachService>;
  referralOutcomeService?: Partial<ReferralOutcomeService>;
  offlineResponseService?: Partial<OfflineResponseService>;
  logger?: Logger;
}) {
  const defaultMemberService: MemberService = {
    findById: mock(() => Promise.resolve({} as MemberDocument)),
    findNamesByIds: mock(() => Promise.resolve(new Map<string, string>())),
    updateName: mock(() => Promise.resolve({} as MemberDocument)),
    updateReferralNotifications: mock(() =>
      Promise.resolve({} as MemberDocument),
    ),
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
    listReferrals: mock(() => Promise.resolve([])),
    listAllReferrals: mock(() => Promise.resolve([])),
    getReferral: mock(() =>
      Promise.reject(new Error("getReferral not configured in test")),
    ),
    listReferralsWithMemberResponse: mock(() => Promise.resolve([])),
    listMemberResponses: mock(() => Promise.resolve([])),
    listLegacyResponses: mock(() => Promise.resolve([])),
    ...overrides?.referralsService,
  };

  const defaultOutreachService: OutreachService = {
    reserveOutreach: mock(() => Promise.resolve("reserved" as const)),
    recordOutreach: mock(() => Promise.resolve()),
    releaseOutreach: mock(() => Promise.resolve()),
    sendOutreachEmail: mock(() =>
      Promise.resolve({ mailgunMessageId: "<mailgun-id@example.com>" }),
    ),
    findPublishedProfileUrl: mock(() => Promise.resolve(undefined)),
    ...overrides?.outreachService,
  };

  const defaultReferralOutcomeService: ReferralOutcomeService = {
    setOutcome: mock(() => Promise.resolve()),
    clearOutcome: mock(() => Promise.resolve()),
    ...overrides?.referralOutcomeService,
  };

  const defaultOfflineResponseService: OfflineResponseService = {
    listMemberDoulas: mock(() => Promise.resolve([])),
    listUnclaimedLegacyMemberships: mock(() => Promise.resolve([])),
    recordMemberOfflineResponse: mock(() =>
      Promise.resolve("recorded" as const),
    ),
    recordLegacyOfflineResponse: mock(() =>
      Promise.resolve("recorded" as const),
    ),
    deleteMemberOfflineResponse: mock(() => Promise.resolve()),
    deleteLegacyOfflineResponse: mock(() => Promise.resolve()),
    ...overrides?.offlineResponseService,
  };

  // Default: Referral Portal v2 switch on, so tests exercise membership rules.
  // Gate-off scenarios override getReferralPortalSettings explicitly.
  const defaultReferralPortalSettingsService: ReferralPortalSettingsService = {
    getReferralPortalSettings: mock(() =>
      Promise.resolve({
        v2Enabled: true,
        updatedAt: "2026-11-22T12:00:00.000Z",
        updatedBy: "admin-user",
      }),
    ),
    updateReferralPortalSettings: mock(() =>
      Promise.reject(
        new Error("updateReferralPortalSettings not used by members-api"),
      ),
    ),
    ...overrides?.referralPortalSettingsService,
  };

  return createMembersPlugin({
    memberService: defaultMemberService,
    newsletterService: defaultNewsletterService,
    authService: defaultAuthService,
    emailService: defaultEmailService,
    verifyEmailService: defaultVerifyEmailService,
    memberFirestoreService: defaultMemberFirestoreService,
    referralsService: defaultReferralsService,
    referralPortalSettingsService: defaultReferralPortalSettingsService,
    outreachService: defaultOutreachService,
    referralOutcomeService: defaultReferralOutcomeService,
    offlineResponseService: defaultOfflineResponseService,
    ...(overrides?.logger !== undefined && { logger: overrides.logger }),
  });
}
