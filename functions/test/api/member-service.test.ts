import { describe, it } from "bun:test";

/**
 * Tests for MemberService (no Firestore mocking).
 *
 * MemberService tests that mock Firestore internals are an anti-pattern.
 * Instead, the MemberService interface should be mocked at the route level
 * when testing routes that use it.
 *
 * See test/api/members.test.ts for examples of mocking MemberService
 * at the service interface level.
 *
 * Integration tests with Firestore emulator would go here if needed.
 */
describe("MemberService", () => {
  describe("findById", () => {
    it.skip("MemberService tests require Firestore integration or should mock at service interface level", () => {
      // Don't mock Firestore internals (getFirestore, collection, doc, etc.)
      // Instead, mock the MemberService interface when testing routes
      //
      // Example in members route test:
      // const mockMemberService = {
      //   findById: mock(() => Promise.resolve(mockMemberData))
      // };
    });
  });
});
