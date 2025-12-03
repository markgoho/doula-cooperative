/* eslint-disable @typescript-eslint/no-confusing-void-expression */
/* eslint-disable @typescript-eslint/await-thenable */
import { afterAll, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../src/collections/index.js";
import { setProfileSlug } from "../src/index.js";
import { createMockCallableRequest } from "../src/test-utils/mock-request.js";
import { initializeTest } from "../src/test-utils/test-setup.js";
import { type MemberDocument } from "../src/types/member-document.js";

const test = initializeTest();

function setup({
  testUid = "test-set-slug-001",
  testEmail = "testsetslug001@example.com",
  membershipActive = true,
  existingSlug,
}: {
  testUid?: string;
  testEmail?: string;
  membershipActive?: boolean;
  existingSlug?: string;
} = {}) {
  const wrappedSetProfileSlug = test.wrap(setProfileSlug);
  const firestore = getFirestore();

  return {
    testUid,
    testEmail,
    membershipActive,
    existingSlug,
    wrappedSetProfileSlug,
    firestore,
  };
}

async function createMemberDocument({
  firestore,
  uid,
  email,
  membershipActive = true,
  slug,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  membershipActive?: boolean;
  slug?: string;
}) {
  const memberData: MemberDocument = {
    createdAt: Timestamp.now(),
    email,
    uid,
    name: "Test Doula",
    membershipActive,
    ...(slug && { slug }),
  };

  await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData);
}

describe("setProfileSlug", () => {
  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user not authenticated", () => {
    const { wrappedSetProfileSlug } = setup();

    const unauthenticatedRequest = createMockCallableRequest({
      data: { slug: "test-slug" },
    });

    expect(wrappedSetProfileSlug(unauthenticatedRequest)).rejects.toThrow(
      "The function must be called while authenticated.",
    );
  });

  it("should return invalid-argument when slug is missing", () => {
    const { wrappedSetProfileSlug, testUid, testEmail } = setup();

    const request = createMockCallableRequest({
      data: {},
      uid: testUid,
      email: testEmail,
    });

    expect(wrappedSetProfileSlug(request)).rejects.toThrow("Slug is required.");
  });

  it("should return invalid-argument when slug has uppercase", () => {
    const { wrappedSetProfileSlug, testUid, testEmail } = setup();

    const request = createMockCallableRequest({
      data: { slug: "Jane-Smith" },
      uid: testUid,
      email: testEmail,
    });

    expect(wrappedSetProfileSlug(request)).rejects.toThrow(
      "Slug must contain only lowercase letters, numbers, and hyphens.",
    );
  });

  it("should return invalid-argument when slug has special characters", () => {
    const { wrappedSetProfileSlug, testUid, testEmail } = setup();

    const request = createMockCallableRequest({
      data: { slug: "jane_smith!" },
      uid: testUid,
      email: testEmail,
    });

    expect(wrappedSetProfileSlug(request)).rejects.toThrow(
      "Slug must contain only lowercase letters, numbers, and hyphens.",
    );
  });

  it("should return failed-precondition when membership not active", async () => {
    const { wrappedSetProfileSlug, testUid, testEmail, firestore } = setup({
      membershipActive: false,
    });

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      membershipActive: false,
    });

    const request = createMockCallableRequest({
      data: { slug: "new-slug" },
      uid: testUid,
      email: testEmail,
    });

    await expect(wrappedSetProfileSlug(request)).rejects.toThrow(
      "User does not have an active membership.",
    );
  });

  it("should return failed-precondition when user already has a slug", async () => {
    const { wrappedSetProfileSlug, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
      slug: "existing-slug",
    });

    const request = createMockCallableRequest({
      data: { slug: "new-slug" },
      uid: testUid,
      email: testEmail,
    });

    await expect(wrappedSetProfileSlug(request)).rejects.toThrow(
      "User already has a profile slug. Contact support to change it.",
    );
  });

  it("should return already-exists when slug is taken by another user", async () => {
    const { wrappedSetProfileSlug, testUid, testEmail, firestore } = setup();

    // Create member without slug
    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
    });

    // Create another member with the desired slug
    await createMemberDocument({
      firestore,
      uid: "other-user",
      email: "other@example.com",
      slug: "taken-slug",
    });

    const request = createMockCallableRequest({
      data: { slug: "taken-slug" },
      uid: testUid,
      email: testEmail,
    });

    await expect(wrappedSetProfileSlug(request)).rejects.toThrow(
      "This slug is already taken. Please choose another.",
    );
  });

  it("should successfully set slug for member", async () => {
    const { wrappedSetProfileSlug, testUid, testEmail, firestore } = setup();

    await createMemberDocument({
      firestore,
      uid: testUid,
      email: testEmail,
    });

    const request = createMockCallableRequest({
      data: { slug: "jane-smith" },
      uid: testUid,
      email: testEmail,
    });

    const result = await wrappedSetProfileSlug(request);

    expect(result).toEqual({ success: true, slug: "jane-smith" });

    // Verify slug was set in Firestore
    const memberDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(testUid)
      .get();
    const memberData = memberDocument.data() as MemberDocument;
    expect(memberData.slug).toBe("jane-smith");
  });
});
