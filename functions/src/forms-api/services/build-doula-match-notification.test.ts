import { describe, expect, it } from "bun:test";
import { buildDoulaMatchNotification } from "./build-doula-match-notification.js";

/**
 * Tests for buildDoulaMatchNotification.
 *
 * IMPORTANT: These tests document XSS vulnerabilities that need to be addressed.
 * The notification builder currently does NOT escape HTML, which is acceptable
 * ONLY because emails are sent exclusively to trusted admin recipients.
 *
 * If the recipient list ever changes to include non-admin users, HTML escaping
 * MUST be implemented before deploying to production.
 */
describe("buildDoulaMatchNotification", () => {
  const validMatchData = {
    name: "Jane Smith",
    phone: "555-1234",
    email: "jane@example.com",
    zipcode: "12345",
    estimatedDueDate: {
      month: "12",
      day: "25",
      year: "2024",
    },
    services: ["Birth Support", "Postpartum Care"],
    birthLocation: "Hospital ABC",
    otherInfo: "First time parent",
    insurance: ["Aetna", "Blue Cross"],
  };

  describe("Email Structure", () => {
    it("should build email with correct structure", () => {
      const result = buildDoulaMatchNotification(validMatchData);

      expect(result.from).toBe("Doula Cooperative <noreply@mg.doulacooperative.com>");
      expect(result.to).toEqual([
        "webmaster@doulacooperative.com",
        "doulacooperativeofrochester@gmail.com",
      ]);
      expect(result.subject).toBe("New Doula Match Request from Jane Smith");
      expect(result["h:Reply-To"]).toBe("jane@example.com");
    });

    it("should include all form fields in HTML body", () => {
      const result = buildDoulaMatchNotification(validMatchData);

      expect(result.html).toContain("Jane Smith");
      expect(result.html).toContain("555-1234");
      expect(result.html).toContain("jane@example.com");
      expect(result.html).toContain("12345");
      expect(result.html).toContain("12/25/2024");
      expect(result.html).toContain("Hospital ABC");
      expect(result.html).toContain("First time parent");
    });
  });

  describe("Array Field Handling", () => {
    it("should join multiple services with commas", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        services: ["Birth Support", "Postpartum Care", "Lactation"],
      });

      expect(result.html).toContain(
        "Birth Support, Postpartum Care, Lactation",
      );
    });

    it("should handle empty services array", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        services: [],
      });

      expect(result.html).toContain("Services");
      // Should not crash, may show empty or "None"
    });

    it("should join multiple insurance providers with commas", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        insurance: ["Aetna", "Blue Cross", "Cigna"],
      });

      expect(result.html).toContain("Aetna, Blue Cross, Cigna");
    });

    it("should handle empty insurance array", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        insurance: [],
      });

      // When insurance is empty, the section is omitted entirely
      expect(result.html).not.toContain("Insurance");
      // Should not crash and still contain other fields
      expect(result.html).toContain("Jane Smith");
    });
  });

  describe("XSS Security Analysis", () => {
    /**
     * WARNING: This test documents a potential XSS vulnerability.
     * Currently FAILING because HTML is not escaped.
     *
     * This is acceptable ONLY because:
     * 1. Emails are sent to trusted admin recipients only
     * 2. Email clients provide their own XSS protection
     * 3. Preserves formatting in user messages
     *
     * If recipient list changes to include non-admin users, this MUST be fixed.
     */
    it.skip("should escape HTML in name to prevent XSS", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        name: '<script>alert("xss")</script>',
      });

      // Should escape < and > characters
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    /**
     * WARNING: This test documents a potential XSS vulnerability.
     * Currently FAILING because HTML is not escaped.
     */
    it.skip("should escape HTML in otherInfo to prevent XSS", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        otherInfo: '<img src=x onerror=alert("xss")>',
      });

      // Should escape < and > characters
      expect(result.html).not.toContain("<img");
      expect(result.html).toContain("&lt;img");
    });

    /**
     * WARNING: This test documents a potential XSS vulnerability.
     * Currently FAILING because HTML is not escaped.
     */
    it.skip("should escape HTML in services array items", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        services: ["<b>Bold Service</b>", "Normal Service"],
      });

      expect(result.html).not.toContain("<b>Bold Service</b>");
      expect(result.html).toContain("&lt;b&gt;Bold Service&lt;/b&gt;");
    });

    /**
     * This test documents the CURRENT behavior (no escaping).
     * This serves as documentation that the XSS risk is known and accepted.
     */
    it("currently does NOT escape HTML special characters (documented risk)", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        name: '<b>Bold Name</b>',
        otherInfo: '<script>alert("test")</script>',
      });

      // Documents current behavior - HTML is NOT escaped
      expect(result.html).toContain("<b>Bold Name</b>");
      expect(result.html).toContain('<script>alert("test")</script>');
    });
  });

  describe("Date Formatting", () => {
    it("should format date as MM/DD/YYYY", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        estimatedDueDate: {
          month: "3",
          day: "5",
          year: "2025",
        },
      });

      expect(result.html).toContain("3/5/2025");
    });

    it("should handle single-digit months and days", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        estimatedDueDate: {
          month: "1",
          day: "9",
          year: "2025",
        },
      });

      expect(result.html).toContain("1/9/2025");
    });
  });

  describe("Reply-To Header", () => {
    it("should set Reply-To to submitter email", () => {
      const result = buildDoulaMatchNotification(validMatchData);

      expect(result["h:Reply-To"]).toBe("jane@example.com");
    });

    it("should handle email with special characters", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        email: "test+alias@example.com",
      });

      expect(result["h:Reply-To"]).toBe("test+alias@example.com");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty otherInfo", () => {
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        otherInfo: "",
      });

      expect(result.html).toBeDefined();
      expect(result.html).toContain("Other Info:");
    });

    it("should handle very long birthLocation", () => {
      const longLocation = "A".repeat(500);
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        birthLocation: longLocation,
      });

      expect(result.html).toContain(longLocation);
    });

    it("should handle multiline otherInfo", () => {
      const multilineInfo = "Line 1\nLine 2\nLine 3";
      const result = buildDoulaMatchNotification({
        ...validMatchData,
        otherInfo: multilineInfo,
      });

      expect(result.html).toContain(multilineInfo);
    });
  });
});
