import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../../constants/github-config.js";
import {
  ConflictError,
  HttpError,
} from "../../../shared-api/errors/http-error.js";
import type { ProfileData } from "../../schemas/profile-schemas.js";
import { serializeToMarkdown } from "../../utils/markdown-serialization.js";
import { getOctokit } from "./get-octokit.js";
import type { WriteProfileResponse } from "./interface.js";

/**
 * Type guard for GitHub API errors.
 */
function isGitHubError(value: unknown): value is {
  status: number;
  response?: { headers?: Record<string, string> };
} {
  return typeof value === "object" && value !== null && "status" in value;
}

/**
 * Type guard for rate limit errors specifically.
 */
function isRateLimitError(value: unknown): value is {
  status: number;
  response: { headers: Record<string, string> };
} {
  return (
    isGitHubError(value) &&
    value.status === 403 &&
    value.response?.headers?.["x-ratelimit-remaining"] === "0"
  );
}

/**
 * Create a new profile on GitHub.
 */
export async function createProfile(options: {
  slug: string;
  data: ProfileData;
}): Promise<WriteProfileResponse> {
  const { slug, data } = options;
  const filePath = `hugo/content/doulas/${slug}/index.md`;

  const octokit = await getOctokit();

  // Create initial metadata for new profile
  const now = new Date().toISOString();
  const initialMetadata = {
    date: now,
    createdAt: now,
    updatedAt: now,
    // New profiles start as draft to prevent accidental premature publication
    draft: true,
  };

  // Serialize the profile data to markdown format
  const content = serializeToMarkdown(data, initialMetadata);

  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: `Create profile for ${data.title}`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: GITHUB_BRANCH,
    });

    logger.info(`Successfully created profile`, { slug });
    return { success: true };
  } catch (error) {
    // Check for GitHub API rate limiting
    if (isRateLimitError(error)) {
      logger.error("GitHub API rate limit exceeded", {
        errorId: ERROR_IDS.CREATE_PROFILE_GITHUB_RATE_LIMIT,
        slug,
        rateLimitReset: error.response.headers["x-ratelimit-reset"],
      });
      throw new HttpError(
        "Too many profile creations. Please try again later.",
        429,
      );
    }

    // Check for file already exists (409 or 422 conflict)
    if (
      isGitHubError(error) &&
      (error.status === 409 || error.status === 422)
    ) {
      logger.error("GitHub file already exists", {
        errorId: ERROR_IDS.CREATE_PROFILE_GITHUB_CONFLICT,
        slug,
        filePath,
      });
      throw new ConflictError(
        "Profile already exists. Use the update endpoint instead.",
      );
    }

    logger.error("Failed to create profile on GitHub", {
      errorId: ERROR_IDS.CREATE_PROFILE_GITHUB_GENERIC,
      slug,
      filePath,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to create profile on GitHub", 500);
  }
}
