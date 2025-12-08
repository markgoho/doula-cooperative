import * as logger from "firebase-functions/logger";
import { type Octokit } from "octokit";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../constants/github-config.js";

export interface ProfileFromGitHub {
  content: string;
  image?: string;
}

/**
 * Fetches a profile's markdown content and image URL from GitHub.
 * This helper is used by both user-facing and admin profile read functions.
 *
 * @param slug - The profile slug (used to construct file paths)
 * @param octokit - Authenticated Octokit instance
 * @returns Profile content and optional image URL
 * @throws Error if GitHub API fails or file doesn't exist
 */
export async function fetchProfileFromGitHub(
  slug: string,
  octokit: Octokit,
): Promise<ProfileFromGitHub> {
  const filePath = `hugo/content/doulas/${slug}/index.md`;

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
  let image: string | undefined;

  // Use the 600px variant as it's the standard size for profile display
  const imagePath = `hugo/content/doulas/${slug}/${slug}-profile-600.avif`;
  const imageUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/refs/heads/${GITHUB_BRANCH}/${imagePath}`;

  try {
    const { data: imageData } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: imagePath,
    });

    if ("content" in imageData) {
      // Return the full GitHub URL for the image
      image = imageUrl;
    }
  } catch {
    // Image doesn't exist, which is fine - continue without it
    logger.info(`Profile image not found for slug ${slug}`);
  }

  return {
    content,
    ...(image !== undefined && { image }),
  };
}
