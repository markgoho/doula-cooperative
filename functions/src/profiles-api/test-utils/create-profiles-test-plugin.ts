import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import type { MemberDocument } from "../../collections/index.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import { createMockVerifyAuthToken } from "../../test-utils/auth-mocks.js";
import { createProfilesPlugin } from "../plugins/profiles-plugin.js";
import type { ProfileData } from "../schemas/profile-schemas.js";
import type { AuthUpdateService } from "../services/auth-update/interface.js";
import type { ClaimProfileFirestoreService } from "../services/firestore/interface.js";
import type { ProfileGitHubService } from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";

/**
 * Default mock member document for testing.
 */
export const mockMemberDocument: MemberDocument = {
  uid: "test-user-123",
  email: "user@example.com",
  name: "Test User",
  membershipActive: true,
  createdAt: Timestamp.now(),
  subscriptionStart: Timestamp.now(),
  membershipExpiresAt: Timestamp.now(),
  slug: "test-user",
  profileCreatedAt: Timestamp.now(),
  imagekitPath: "test-user/test-user-profile.jpg",
  imagekitFileId: "test-imagekit-file-id",
};

/**
 * Default mock profile data for testing (structured JSON response).
 */
export const mockProfileData: ProfileData = {
  title: "Test Doula",
  bio: "This is a test bio for the doula profile.",
  credentials: "CD(DONA)",
  pronouns: "she/her",
  tags: ["birth-doula", "postpartum"],
  contact: {
    email: "test@example.com",
    phone: "555-0123",
  },
  draft: false,
};

/**
 * Helper function to create a mock Firestore DocumentSnapshot.
 */
function createMockDocumentSnapshot(
  exists: boolean,
  data?: unknown,
): DocumentSnapshot {
  return {
    exists,
    id: "test-document",
    data: () => data,
  } as DocumentSnapshot;
}

/**
 * Creates the profiles plugin with default mock services for testing.
 * Tests only the profiles plugin in isolation - no full app composition needed.
 *
 * Note: Logger is not mocked - tests use the real Firebase logger.
 * This keeps tests simpler and ensures logging code paths are exercised.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured profiles plugin with mocked services
 */
export function createProfilesTestPlugin(overrides?: {
  profileGitHubService?: Partial<ProfileGitHubService>;
  profileMemberService?: Partial<ProfileMemberService>;
  authService?: Partial<AuthService>;
  emailService?: Partial<EmailServiceInterface>;
  claimProfileFirestoreService?: Partial<ClaimProfileFirestoreService>;
  authUpdateService?: Partial<AuthUpdateService>;
}) {
  const defaultProfileGitHubService: ProfileGitHubService = {
    readProfile: mock(() =>
      Promise.resolve({
        ...mockProfileData,
        image:
          "https://ik.imagekit.io/doulacoop/test-user/test-user-profile.jpg",
      }),
    ),
    writeProfile: mock(() => Promise.resolve({ success: true as const })),
    createProfile: mock(() => Promise.resolve({ success: true as const })),
    ...overrides?.profileGitHubService,
  };

  const defaultProfileMemberService: ProfileMemberService = {
    getMemberByUid: mock(() => Promise.resolve({ ...mockMemberDocument })),
    verifyActiveMembership: mock(() =>
      Promise.resolve({ ...mockMemberDocument }),
    ),
    checkSlugAvailable: mock(() => Promise.resolve({ available: true })),
    setSlug: mock(() => Promise.resolve({ slug: "test-user" })),
    setProfileCreatedAt: mock(() => Promise.resolve()),
    getMemberBySlug: mock(() => Promise.resolve({ ...mockMemberDocument })),
    ...overrides?.profileMemberService,
  };

  const defaultAuthService: AuthService = {
    verifyAuthToken: createMockVerifyAuthToken(),
    verifyAdmin: mock(() =>
      Promise.resolve({
        uid: "admin-user",
        email: "admin@example.com",
      } as DecodedIdToken),
    ),
    verifyOwnerOrAdmin: mock(() =>
      Promise.resolve({
        uid: "test-user-123",
        email: "user@example.com",
      } as DecodedIdToken),
    ),
    ...overrides?.authService,
  };

  const defaultClaimProfileFirestoreService: ClaimProfileFirestoreService = {
    getImportDocument: mock((email: string) =>
      Promise.resolve(
        createMockDocumentSnapshot(true, {
          name: "Test User",
          email,
          subscriptionStart: Timestamp.now(),
          lastPayment: Timestamp.now(),
          nextPayment: Timestamp.now(),
        }),
      ),
    ),
    writeMemberDocument: mock(() => Promise.resolve()),
    deleteImportDocument: mock(() => Promise.resolve()),
    ...overrides?.claimProfileFirestoreService,
  };

  const defaultEmailService: EmailServiceInterface = {
    sendEmail: mock(() => Promise.resolve()),
    ...overrides?.emailService,
  };

  const defaultAuthUpdateService: AuthUpdateService = {
    updateDisplayName: mock(() => Promise.resolve()),
    ...overrides?.authUpdateService,
  };

  return createProfilesPlugin({
    profileGitHubService: defaultProfileGitHubService,
    profileMemberService: defaultProfileMemberService,
    authService: defaultAuthService,
    emailService: defaultEmailService,
    claimProfileFirestoreService: defaultClaimProfileFirestoreService,
    authUpdateService: defaultAuthUpdateService,
  });
}
