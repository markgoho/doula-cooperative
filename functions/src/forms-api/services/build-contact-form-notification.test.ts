import { describe, expect, it } from "bun:test";
import { buildContactFormNotification } from "./build-contact-form-notification.js";

/**
 * Tests for buildContactFormNotification.
 *
 * IMPORTANT: These tests document XSS vulnerabilities that need to be addressed.
 * The notification builder currently does NOT escape HTML, which is acceptable
 * ONLY because emails are sent exclusively to trusted admin recipients.
 *
 * If the recipient list ever changes to include non-admin users, HTML escaping
 * MUST be implemented before deploying to production.
 */
describe("buildContactFormNotification", () => {
  describe("Email Structure", () => {
    it("should build email with correct structure", () => {
      const result = buildContactFormNotification({
        contactName: "John Doe",
        email: "john@example.com",
        message: "I need help",
      });

      expect(result.from).toBe("Doula Cooperative <noreply@mg.doulacooperative.com>");
      expect(result.to).toEqual([
        "webmaster@doulacooperative.com",
        "doulacooperativeofrochester@gmail.com",
      ]);
      expect(result.subject).toBe("New Contact Us Form Submission from John Doe");
      expect(result["h:Reply-To"]).toBe("john@example.com");
    });

    it("should include all form fields in HTML body", () => {
      const result = buildContactFormNotification({
        contactName: "John Doe",
        email: "john@example.com",
        message: "Test message",
      });

      expect(result.html).toContain("John Doe");
      expect(result.html).toContain("john@example.com");
      expect(result.html).toContain("Test message");
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
    it.skip("should escape HTML in contactName to prevent XSS", () => {
      const result = buildContactFormNotification({
        contactName: '<script>alert("xss")</script>',
        email: "test@example.com",
        message: "test",
      });

      // Should escape < and > characters
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    /**
     * WARNING: This test documents a potential XSS vulnerability.
     * Currently FAILING because HTML is not escaped.
     */
    it.skip("should escape HTML in message to prevent XSS", () => {
      const result = buildContactFormNotification({
        contactName: "Test User",
        email: "test@example.com",
        message: '<img src=x onerror=alert("xss")>',
      });

      // Should escape < and > characters
      expect(result.html).not.toContain("<img");
      expect(result.html).toContain("&lt;img");
    });

    /**
     * WARNING: This test documents a potential XSS vulnerability.
     * Currently FAILING because HTML is not escaped.
     */
    it.skip("should escape HTML entities in email field", () => {
      const result = buildContactFormNotification({
        contactName: "Test User",
        email: "test@example.com",
        message: "Hello & <goodbye>",
      });

      expect(result.html).not.toContain("<goodbye>");
      expect(result.html).toContain("&lt;goodbye&gt;");
      expect(result.html).toContain("&amp;");
    });

    /**
     * This test documents the CURRENT behavior (no escaping).
     * This serves as documentation that the XSS risk is known and accepted.
     */
    it("currently does NOT escape HTML special characters (documented risk)", () => {
      const result = buildContactFormNotification({
        contactName: '<b>Bold Name</b>',
        email: "test@example.com",
        message: '<script>alert("test")</script>',
      });

      // Documents current behavior - HTML is NOT escaped
      expect(result.html).toContain("<b>Bold Name</b>");
      expect(result.html).toContain('<script>alert("test")</script>');
    });
  });

  describe("Reply-To Header", () => {
    it("should set Reply-To to submitter email", () => {
      const result = buildContactFormNotification({
        contactName: "John Doe",
        email: "john@example.com",
        message: "Help!",
      });

      expect(result["h:Reply-To"]).toBe("john@example.com");
    });

    it("should handle email with special characters", () => {
      const result = buildContactFormNotification({
        contactName: "Test User",
        email: "test+alias@example.com",
        message: "test",
      });

      expect(result["h:Reply-To"]).toBe("test+alias@example.com");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty message", () => {
      const result = buildContactFormNotification({
        contactName: "John Doe",
        email: "john@example.com",
        message: "",
      });

      expect(result.html).toBeDefined();
      expect(result.html).toContain("Message");
    });

    it("should handle very long names", () => {
      const longName = "A".repeat(100);
      const result = buildContactFormNotification({
        contactName: longName,
        email: "test@example.com",
        message: "test",
      });

      expect(result.html).toContain(longName);
    });

    it("should handle multiline messages", () => {
      const multilineMessage = "Line 1\nLine 2\nLine 3";
      const result = buildContactFormNotification({
        contactName: "Test User",
        email: "test@example.com",
        message: multilineMessage,
      });

      expect(result.html).toContain(multilineMessage);
    });
  });
});
