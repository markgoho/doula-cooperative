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
import { batchDeleteFiles } from "../utils/github-batch-delete.js";
import { isRateLimitError } from "../utils/github-error.js";

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
      errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_FIRESTORE_READ_ERROR,
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

  // 4. Delete all profile image files in a single commit
  const filePaths = IMAGE_FILE_PATTERNS.map(
    (pattern) => `${baseDirectory}/${slug}${pattern}`,
  );

  try {
    const result = await batchDeleteFiles({
      octokit,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      filePaths,
      commitMessage: `Delete all profile images for ${slug}`,
    });

    logger.info(`Successfully deleted profile images for ${slug}`, {
      deletedFiles: result.deletedFiles,
      commitSha: result.commitSha,
    });

    return {
      success: true,
      deletedFiles: result.deletedFiles,
    };
  } catch (error: unknown) {
    // Rate limit error
    if (isRateLimitError(error)) {
      logger.error("GitHub API rate limit exceeded during delete", {
        errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_RATE_LIMIT,
        uid,
        slug,
      });
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Please try again later.",
      );
    }

    // Other errors
    logger.error("Failed to delete profile images", {
      errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_FAILED,
      uid,
      slug,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to delete profile image. Please try again.",
    );
  }
}
