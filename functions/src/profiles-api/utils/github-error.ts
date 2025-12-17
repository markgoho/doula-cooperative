/**
 * Type guard for GitHub API errors.
 * GitHub errors have a status property indicating the HTTP status code.
 */
export interface GitHubApiError {
  status: number;
  response?: {
    headers?: Record<string, string>;
  };
}

/**
 * Type guard to check if an error is a GitHub API error.
 */
export function isGitHubError(value: unknown): value is GitHubApiError {
  return typeof value === "object" && value !== null && "status" in value;
}

/**
 * Check if the error is a rate limit error (403 with x-ratelimit-remaining: 0)
 */
export function isRateLimitError(error: unknown): boolean {
  if (!isGitHubError(error) || error.status !== 403) {
    return false;
  }
  return error.response?.headers?.["x-ratelimit-remaining"] === "0";
}
