import { logger } from "firebase-functions/v2";
import { App } from "octokit";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../../constants/github-config.js";
import { HttpError } from "../../../shared-api/errors/http-error.js";

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
 * Delete a Hugo profile file via the GitHub API.
 *
 * Reads the profile file to get the SHA (required by the GitHub API),
 * then deletes it. Handles 404 gracefully (profile file may not exist).
 */
export async function deleteProfile(options: {
  slug: string;
}): Promise<{ success: true }> {
  const { slug } = options;
  const filePath = `hugo/content/doulas/${slug}/index.md`;

  const octokit = await getOctokit();

  let sha: string;
  try {
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
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

  await octokit.rest.repos.deleteFile({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: filePath,
    message: `Delete profile: ${slug}`,
    sha,
    branch: GITHUB_BRANCH,
  });

  logger.info("Successfully deleted profile from GitHub", { slug });

  return { success: true };
}
