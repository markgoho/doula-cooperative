import { describe, expect, it } from "bun:test";
import { isGitHubError, isRateLimitError } from "./github-error.js";

describe("isGitHubError", () => {
  it("should return true for object with status property", () => {
    expect(isGitHubError({ status: 404 })).toBe(true);
  });

  it("should return true for object with status and response", () => {
    expect(
      isGitHubError({
        status: 403,
        response: { headers: { "x-ratelimit-remaining": "0" } },
      }),
    ).toBe(true);
  });

  it("should return false for null", () => {
    // eslint-disable-next-line unicorn/no-null -- testing null handling
    expect(isGitHubError(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isGitHubError(undefined)).toBe(false);
  });

  it("should return false for primitives", () => {
    expect(isGitHubError("error")).toBe(false);
    expect(isGitHubError(42)).toBe(false);
    expect(isGitHubError(true)).toBe(false);
  });

  it("should return false for objects without status property", () => {
    expect(isGitHubError({})).toBe(false);
    expect(isGitHubError({ message: "error" })).toBe(false);
    expect(isGitHubError({ code: 404 })).toBe(false);
  });

  it("should return false for arrays", () => {
    expect(isGitHubError([404])).toBe(false);
    expect(isGitHubError([])).toBe(false);
  });
});

describe("isRateLimitError", () => {
  it("should return true for 403 with x-ratelimit-remaining: 0", () => {
    const error = {
      status: 403,
      response: {
        headers: {
          "x-ratelimit-remaining": "0",
        },
      },
    };
    expect(isRateLimitError(error)).toBe(true);
  });

  it("should return false when status is not 403", () => {
    const error = {
      status: 401,
      response: {
        headers: {
          "x-ratelimit-remaining": "0",
        },
      },
    };
    expect(isRateLimitError(error)).toBe(false);
  });

  it("should return false when x-ratelimit-remaining is not 0", () => {
    const error = {
      status: 403,
      response: {
        headers: {
          "x-ratelimit-remaining": "10",
        },
      },
    };
    expect(isRateLimitError(error)).toBe(false);
  });

  it("should return false when response is missing", () => {
    const error = { status: 403 };
    expect(isRateLimitError(error)).toBe(false);
  });

  it("should return false when headers are missing", () => {
    const error = { status: 403, response: {} };
    expect(isRateLimitError(error)).toBe(false);
  });

  it("should return false when x-ratelimit-remaining header is missing", () => {
    const error = {
      status: 403,
      response: {
        headers: {
          "content-type": "application/json",
        },
      },
    };
    expect(isRateLimitError(error)).toBe(false);
  });

  it("should return false for non-GitHub errors", () => {
    // eslint-disable-next-line unicorn/no-null -- testing null handling
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError("error")).toBe(false);
    expect(isRateLimitError(new Error("test"))).toBe(false);
  });

  it("should return false for generic 403 without rate limit header", () => {
    // This is the key test - a permission denied error should NOT be treated as rate limit
    const permissionDeniedError = {
      status: 403,
      response: {
        headers: {
          "content-type": "application/json",
        },
      },
    };
    expect(isRateLimitError(permissionDeniedError)).toBe(false);
  });
});
