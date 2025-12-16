import { logger } from "firebase-functions/v2";
import { App } from "octokit";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../../constants/github-config.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError, NotFoundError } from "../../../shared-api/errors/http-error.js";
import {
  isGitHubError,
  isRateLimitError,
} from "../../../utils/github-error.js";
import type { ReadProfileResponse } from "./interface.js";

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
 * Attempts to find a profile image, with fallback from AVIF to JPEG.
 * This ensures users see their image immediately after upload (JPEG),
 * before the AVIF conversion workflow completes.
 */
async function findProfileImage(
  slug: string,
  octokit: Awaited<ReturnType<typeof getOctokit>>,
): Promise<string | undefined> {
  const baseDirectory = `hugo/content/doulas/${slug}`;
  const baseUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/refs/heads/${GITHUB_BRANCH}`;

  // Image candidates in priority order: optimized AVIF first, then raw JPEG
  const imageCandidates = [
    {
      path: `${baseDirectory}/${slug}-profile-600.avif`,
      description: "optimized AVIF",
    },
    { path: `${baseDirectory}/${slug}-profile.jpg`, description: "raw JPEG" },
  ];

  for (const candidate of imageCandidates) {
    try {
      const { data: imageData } = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: candidate.path,
      });

      if ("content" in imageData) {
        logger.info(`Found ${candidate.description} for slug ${slug}`);
        return `${baseUrl}/${candidate.path}`;
      }
    } catch (error) {
      // Check for 404 - this is expected when image doesn't exist
      if (isGitHubError(error) && error.status === 404) {
        logger.info(`${candidate.description} not found for slug ${slug}`, {
          path: candidate.path,
        });
        continue; // Try next candidate
      }

      // Check for rate limiting - should fail fast, not try more requests
      if (isRateLimitError(error)) {
        logger.error(
          "GitHub API rate limit exceeded while checking profile image",
          {
            errorId: ERROR_IDS.API_PROFILE_READ_FAILED,
            slug,
            path: candidate.path,
          },
        );
        throw new HttpError(
          "Unable to load profile image due to rate limiting. Please try again later.",
          429,
        );
      }

      // Log unexpected errors with full context and fail the operation
      logger.error("Unexpected error checking for profile image", {
        errorId: ERROR_IDS.API_PROFILE_READ_FAILED,
        slug,
        path: candidate.path,
        candidateDescription: candidate.description,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
        githubStatus: isGitHubError(error) ? error.status : undefined,
      });

      // Re-throw to surface the error to the user
      // Don't mask infrastructure problems as "no image"
      throw new HttpError(
        "Unable to check for profile image. Please try again.",
        500,
      );
    }
  }

  logger.info(`No profile image found for slug ${slug}`);
  return undefined;
}

/**
 * Read a profile's content and image from GitHub.
 */
export async function readProfile(options: {
  slug: string;
}): Promise<ReadProfileResponse> {
  const { slug } = options;
  const filePath = `hugo/content/doulas/${slug}/index.md`;

  const octokit = await getOctokit();

  try {
    // Fetch the markdown content
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
    });

    // Safety check to ensure we got a file and not a directory
    if (!("content" in fileData)) {
      throw new Error("Path did not resolve to a file.");
    }

    // Decode the content
    const content = Buffer.from(fileData.content, "base64").toString("utf8");

    // Check if profile image exists
    const image = await findProfileImage(slug, octokit);

    return {
      content,
      ...(image !== undefined && { image }),
    };
  } catch (error) {
    // Type guard for GitHub API errors
    const isGitHubError = (
      value: unknown,
    ): value is { status: number } => {
      return typeof value === "object" && value !== null && "status" in value;
    };

    if (isGitHubError(error) && error.status === 404) {
      logger.warn("Profile not found on GitHub", {
        errorId: ERROR_IDS.API_PROFILE_NOT_FOUND,
        slug,
        filePath,
      });
      throw new NotFoundError("Profile not found");
    }

    logger.error("Failed to read profile from GitHub", {
      errorId: ERROR_IDS.API_GITHUB_READ_FAILED,
      slug,
      filePath,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to read profile from GitHub", 500);
  }
}
