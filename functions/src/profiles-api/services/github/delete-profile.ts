import { logger } from "firebase-functions/v2";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../../constants/github-config.js";
import { getOctokit } from "./get-octokit.js";

/**
 * Delete a Hugo profile file via the GitHub API.
 *
 * Reads the profile file to get the SHA (required by the GitHub API),
 * then deletes it. Handles 404 gracefully (profile file may not exist).
 * Skips in emulator mode since GitHub is an external service.
 */
export async function deleteProfile(options: {
  slug: string;
}): Promise<{ success: true }> {
  const { slug } = options;

  if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.info("Emulator detected, skipping GitHub profile delete", { slug });
    return { success: true };
  }

  const filePath = `hugo/content/doulas/${slug}/index.md`;

  const octokit = await getOctokit();

  let sha: string;
  try {
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      ref: GITHUB_BRANCH,
    });

    if (!("sha" in fileData)) {
      throw new Error("Path did not resolve to a file.");
    }

    sha = fileData.sha;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status: number }).status === 404
    ) {
      logger.info("Profile file not found on GitHub, skipping delete", {
        slug,
        filePath,
      });
      return { success: true };
    }
    throw error;
  }

  try {
    await octokit.rest.repos.deleteFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: `Delete profile: ${slug}`,
      sha,
      branch: GITHUB_BRANCH,
    });
  } catch (error) {
    logger.error("Failed to delete profile file from GitHub", {
      slug,
      filePath,
      sha,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  logger.info("Successfully deleted profile from GitHub", { slug });

  return { success: true };
}
