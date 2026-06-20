import { describe, expect, it } from "bun:test";
import { isDoulaRequest } from "./detect-doula-request.js";

describe("isDoulaRequest", () => {
  it("detects requests for overnight postpartum help after a c section", () => {
    const message =
      "My name is Veronica and I’m based in Victor, NY. I had a baby 2.5 weeks ago via c section and I’m struggling very badly with the lack of sleep manifesting very physically for me. I am looking for overnight help maybe 2 nights a week to try and repair myself by getting rest. Looking forward to hearing if someone is available. Thank you so much.";

    expect(isDoulaRequest(message)).toBe(true);
  });

  it("does not detect generic baby messages without support-seeking language", () => {
    const message =
      "I had my baby recently and have a question about updating my newsletter email address.";

    expect(isDoulaRequest(message)).toBe(false);
  });
});
