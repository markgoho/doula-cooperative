import { describe, expect, it } from "bun:test";
import { generateSecurePassword } from "./generate-secure-password.js";

describe("generateSecurePassword", () => {
  it("should generate a 20-character password", () => {
    const password = generateSecurePassword();
    expect(password).toHaveLength(20);
  });

  it("should only contain allowed characters", () => {
    const password = generateSecurePassword();
    const allowedPattern =
      /^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*]+$/;
    expect(allowedPattern.test(password)).toBe(true);
  });

  it("should generate different passwords on each call", () => {
    const password1 = generateSecurePassword();
    const password2 = generateSecurePassword();
    expect(password1).not.toBe(password2);
  });

  it("should include mix of character types", () => {
    // Generate multiple passwords to reduce false negatives
    const passwords = Array.from({ length: 10 }, () => generateSecurePassword());

    // At least one should have uppercase, lowercase, and number
    const hasVariety = passwords.some((password) => {
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      return hasUppercase && hasLowercase && hasNumber;
    });

    expect(hasVariety).toBe(true);
  });

  it("should not throw errors during generation", () => {
    expect(() => generateSecurePassword()).not.toThrow();
  });
});
