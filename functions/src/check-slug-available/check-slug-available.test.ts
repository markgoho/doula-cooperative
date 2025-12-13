import { afterAll, describe, expect, it } from "bun:test";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../collections/index.js";
import { checkSlugAvailable } from "../index.js";
import { createMockCallableRequest } from "../test-utils/mock-request.js";
import { initializeTest } from "../test-utils/test-setup.js";
import { type MemberDocument } from "../types/member-document.js";

const test = initializeTest();

function setup({
  testUid = "test-check-slug-001",
  testEmail = "testcheckslug001@example.com",
} = {}) {
  const wrappedCheckSlugAvailable = test.wrap(checkSlugAvailable);
  const firestore = getFirestore();

  return {
    testUid,
    testEmail,
    wrappedCheckSlugAvailable,
    firestore,
  };
}

async function createMemberWithSlug({
  firestore,
  uid,
  email,
  slug,
}: {
  firestore: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  slug: string;
}) {
  const memberData: MemberDocument = {
    createdAt: Timestamp.now(),
    email,
    uid,
    name: "Test Doula",
    slug,
    membershipActive: true,
  };

  await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData);
}

describe("checkSlugAvailable", () => {
  afterAll(() => {
    test.cleanup();
  });

  it("should return unauthenticated error when user not authenticated", () => {
    const { wrappedCheckSlugAvailable } = setup();

    const unauthenticatedRequest = createMockCallableRequest({
      data: { slug: "test-slug" },
    });

    expect(wrappedCheckSlugAvailable(unauthenticatedRequest)).rejects.toThrow(
      "The function must be called while authenticated.",
    );
  });

  it("should return invalid-argument when slug is missing", () => {
    const { wrappedCheckSlugAvailable, testUid, testEmail } = setup();

    const request = createMockCallableRequest({
      data: {},
      uid: testUid,
      email: testEmail,
    });

    expect(wrappedCheckSlugAvailable(request)).rejects.toThrow(
      "Slug is required.",
    );
  });

  it("should return invalid-argument when slug has uppercase", () => {
    const { wrappedCheckSlugAvailable, testUid, testEmail } = setup();

    const request = createMockCallableRequest({
      data: { slug: "Jane-Smith" },
      uid: testUid,
      email: testEmail,
    });

    expect(wrappedCheckSlugAvailable(request)).rejects.toThrow(
      "Slug must contain only lowercase letters, numbers, and hyphens.",
    );
  });

  it("should return invalid-argument when slug has special characters", () => {
    const { wrappedCheckSlugAvailable, testUid, testEmail } = setup();

    const request = createMockCallableRequest({
      data: { slug: "jane_smith!" },
      uid: testUid,
      email: testEmail,
    });

    expect(wrappedCheckSlugAvailable(request)).rejects.toThrow(
      "Slug must contain only lowercase letters, numbers, and hyphens.",
    );
  });

  it("should return available: true when slug is not taken", async () => {
    const { wrappedCheckSlugAvailable, testUid, testEmail } = setup();

    const request = createMockCallableRequest({
      data: { slug: "unique-slug-12345" },
      uid: testUid,
      email: testEmail,
    });

    const result = await wrappedCheckSlugAvailable(request);

    expect(result).toEqual({ available: true });
  });

  it("should return available: false when slug is taken", async () => {
    const { wrappedCheckSlugAvailable, testUid, testEmail, firestore } =
      setup();

    // Create a member with the slug
    await createMemberWithSlug({
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

    const result = await wrappedCheckSlugAvailable(request);

    expect(result).toEqual({ available: false });
  });
});
