import { logger } from "firebase-functions/v2";
import { App } from "octokit";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../../constants/github-config.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import {
  HttpError,
  NotFoundError,
  ConflictError,
} from "../../../shared-api/errors/http-error.js";
import type { ProfileData } from "../../schemas/profile-schemas.js";
import type { WriteProfileResponse } from "./interface.js";
import {
  serializeToMarkdown,
  parseExistingMetadata,
} from "../../../write-profile/index.js";

/**
 * Get authenticated Octokit instance using GitHub App credentials.
 */
async function getOctokit() {
  const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
  const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
  const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
    throw new HttpError("GitHub configuration is missing", 500);
  }

  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });

  return app.getInstallationOctokit(Number.parseInt(GITHUB_INSTALLATION_ID));
}

/**
 * Type guard for GitHub API errors.
 */
function isGitHubError(
  value: unknown,
): value is {
  status: number;
  response?: { headers?: Record<string, string> };
} {
  return typeof value === "object" && value !== null && "status" in value;
}

/**
 * Type guard for rate limit errors specifically.
 */
function isRateLimitError(
  value: unknown,
): value is {
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
 * Update an existing profile on GitHub.
 */
export async function writeProfile(options: {
  slug: string;
  data: ProfileData;
  existingSha: string;
}): Promise<WriteProfileResponse> {
  const { slug, data, existingSha } = options;
  const filePath = `hugo/content/doulas/${slug}/index.md`;

  const octokit = await getOctokit();

  try {
    // Fetch the existing file to preserve metadata
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
    });

    if (!("content" in fileData)) {
      throw new Error("Path did not resolve to a file.");
    }

    const existingContent = Buffer.from(fileData.content, "base64").toString(
      "utf8",
    );
    const existingMetadata = parseExistingMetadata(existingContent);

    const newContent = serializeToMarkdown(data, existingMetadata);

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: `Update profile for ${data.title}`,
      content: Buffer.from(newContent, "utf8").toString("base64"),
      sha: existingSha.length > 0 ? existingSha : fileData.sha,
      branch: GITHUB_BRANCH,
    });

    logger.info(`Successfully updated profile`, { slug });
    return { success: true };
  } catch (error) {
    // Check for GitHub API rate limiting
    if (isRateLimitError(error)) {
      logger.error("GitHub API rate limit exceeded", {
        errorId: ERROR_IDS.WRITE_PROFILE_GITHUB_RATE_LIMIT,
        slug,
        rateLimitReset: error.response.headers["x-ratelimit-reset"],
      });
      throw new HttpError(
        "Too many profile updates. Please try again later.",
        429,
      );
    }

    // Check for other GitHub API errors
    if (isGitHubError(error) && error.status === 404) {
      logger.error("GitHub file not found", {
        errorId: ERROR_IDS.WRITE_PROFILE_GITHUB_NOT_FOUND,
        slug,
        filePath,
      });
      throw new NotFoundError("Profile file not found. Please contact support.");
    }

    if (isGitHubError(error) && error.status === 409) {
      logger.error("GitHub conflict - file was modified", {
        errorId: ERROR_IDS.WRITE_PROFILE_GITHUB_CONFLICT,
        slug,
        filePath,
      });
      throw new ConflictError(
        "Profile was modified by another process. Please refresh and try again.",
      );
    }

    logger.error("Failed to write profile to GitHub", {
      errorId: ERROR_IDS.WRITE_PROFILE_GITHUB_GENERIC,
      slug,
      filePath,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to write profile to GitHub", 500);
  }
}
