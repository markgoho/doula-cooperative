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
 * Attempts to find a profile image, with fallback from AVIF to JPEG.
 * This ensures users see their image immediately after upload (JPEG),
 * before the AVIF conversion workflow completes.
 */
async function findProfileImage(
  slug: string,
  octokit: Octokit,
): Promise<string | undefined> {
  const baseDirectory = `hugo/content/doulas/${slug}`;
  const baseUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/refs/heads/${GITHUB_BRANCH}`;

  // Image candidates in priority order: optimized AVIF first, then raw JPEG
  const imageCandidates = [
    { path: `${baseDirectory}/${slug}-profile-600.avif`, description: "optimized AVIF" },
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
      // Only treat 404 as "not found", log other errors for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes("Not Found")) {
        logger.warn(`Unexpected error checking for ${candidate.description}`, {
          error: errorMessage,
          slug,
          path: candidate.path,
        });
      }
      // Continue to next candidate
    }
  }

  logger.info(`No profile image found for slug ${slug}`);
  return undefined;
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

  // Check if profile image exists, with fallback chain:
  // 1. Try optimized AVIF (600px) - preferred
  // 2. Fall back to raw JPEG - available immediately after upload, before AVIF conversion
  const image = await findProfileImage(slug, octokit);

  return {
    content,
    ...(image !== undefined && { image }),
  };
}
