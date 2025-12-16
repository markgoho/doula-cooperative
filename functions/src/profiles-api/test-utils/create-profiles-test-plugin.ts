import { mock } from "bun:test";
import type { DecodedIdToken } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import type { MemberDocument } from "../../collections/index.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import { createMockVerifyAuthToken } from "../../test-utils/auth-mocks.js";
import { createProfilesPlugin } from "../plugins/profiles-plugin.js";
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
};

/**
 * Default mock profile content for testing.
 */
export const mockProfileContent = `---
title: Test Doula
bio: This is a test bio for the doula profile.
credentials: CD(DONA)
pronouns: she/her
tags:
  - birth-doula
  - postpartum
contact:
  email: test@example.com
  phone: 555-0123
draft: false
---

This is a test bio for the doula profile.
`;

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
}) {
  const defaultProfileGitHubService: ProfileGitHubService = {
    readProfile: mock(() =>
      Promise.resolve({
        content: mockProfileContent,
        image: "https://example.com/image.jpg",
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

  return createProfilesPlugin({
    profileGitHubService: defaultProfileGitHubService,
    profileMemberService: defaultProfileMemberService,
    authService: defaultAuthService,
  });
}
