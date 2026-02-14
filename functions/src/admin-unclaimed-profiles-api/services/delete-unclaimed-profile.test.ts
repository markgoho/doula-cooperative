import { describe, expect, it } from "bun:test";
import { deleteUnclaimedProfile } from "./delete-unclaimed-profile.js";

describe("deleteUnclaimedProfile service", () => {
  it("should be a callable async function", () => {
    expect(typeof deleteUnclaimedProfile).toBe("function");
  });

  it("should accept required parameters", () => {
    const signature = deleteUnclaimedProfile.toString();
    expect(signature).toContain("email");
    expect(signature).toContain("mailerliteApiKey");
    expect(signature).toContain("emailService");
    expect(signature).toContain("logger");
  });
});
