import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { App } from "octokit";
import { MEMBERS_COLLECTION } from "../collections/index.js";
import { ERROR_IDS } from "../constants/error-ids.js";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../constants/github-config.js";
import { type MemberDocument } from "../types/member-document.js";
import { isGitHubError, isRateLimitError } from "../utils/github-error.js";

/**
 * All possible profile image file patterns to delete.
 * Includes source images and generated AVIF variants.
 */
const IMAGE_FILE_PATTERNS = [
  "-profile.jpg",
  "-profile.jpeg",
  "-profile.png",
  "-profile.webp",
  "-profile-1200.avif",
  "-profile-600.avif",
  "-profile-300.avif",
];

export async function handler(
  request: CallableRequest,
  [GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID]: [
    string,
    string,
    string,
  ],
) {
  // 1. Validate authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const uid = request.auth.uid;
  logger.info(`Profile image delete initiated for user: ${uid}`);

  // 2. Get member document and verify membership
  let memberDocument;
  try {
    const database = getFirestore();
    const memberReference = database.collection(MEMBERS_COLLECTION).doc(uid);
    memberDocument = await memberReference.get();
  } catch (error) {
    logger.error("Failed to read member document", {
      errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_FAILED,
      uid,
      error,
    });
    throw new HttpsError(
      "unavailable",
      "Unable to verify membership. Please try again.",
    );
  }

  if (!memberDocument.exists) {
    throw new HttpsError(
      "not-found",
      "No member document found for this user.",
    );
  }

  const memberData = memberDocument.data() as MemberDocument | undefined;
  if (!memberData) {
    throw new HttpsError("not-found", "Member document data is empty.");
  }

  if (!memberData.membershipActive) {
    throw new HttpsError(
      "failed-precondition",
      "User does not have an active membership.",
    );
  }

  const slug = memberData.slug;
  if (!slug) {
    throw new HttpsError(
      "failed-precondition",
      "Profile slug is required. Please set up your profile first.",
    );
  }

  // 3. Initialize GitHub client
  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });
  const octokit = await app.getInstallationOctokit(
    Number.parseInt(GITHUB_INSTALLATION_ID),
  );

  const baseDirectory = `hugo/content/doulas/${slug}`;

  // 4. Delete all profile image files
  const deletedFiles: string[] = [];
  const errors: string[] = [];

  for (const pattern of IMAGE_FILE_PATTERNS) {
    const filePath = `${baseDirectory}/${slug}${pattern}`;

    try {
      const { data: file } = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
      });

      if ("sha" in file) {
        await octokit.rest.repos.deleteFile({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: filePath,
          message: `Delete profile image file: ${slug}${pattern}`,
          sha: file.sha,
          branch: GITHUB_BRANCH,
        });
        deletedFiles.push(filePath);
        logger.info(`Deleted profile image file: ${filePath}`);
      }
    } catch (error: unknown) {
      // 404 is expected - file doesn't exist
      if (isGitHubError(error) && error.status === 404) {
        continue;
      }

      // Rate limit error - check headers to confirm it's actually rate limiting
      if (isRateLimitError(error)) {
        logger.error("GitHub API rate limit exceeded during delete", {
          errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_RATE_LIMIT,
          uid,
          slug,
          filePath,
        });
        throw new HttpsError(
          "resource-exhausted",
          "Too many requests. Please try again later.",
        );
      }

      // Other errors - log but continue trying other files
      logger.warn(`Failed to delete ${filePath}`, {
        errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_FAILED,
        uid,
        slug,
        filePath,
        error,
      });
      errors.push(filePath);
    }
  }

  // If no files were deleted and there were errors, report failure
  if (deletedFiles.length === 0 && errors.length > 0) {
    logger.error("Failed to delete any profile image files", {
      errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_FAILED,
      uid,
      slug,
      errors,
    });
    throw new HttpsError(
      "internal",
      "Failed to delete profile image. Please try again.",
    );
  }

  logger.info(`Successfully deleted profile images for ${slug}`, {
    deletedFiles,
    errors,
  });

  return {
    success: true,
    deletedFiles,
    ...(errors.length > 0 ? { errors, partialSuccess: true } : {}),
  };
}
