import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { App } from "octokit";
import { MEMBERS_COLLECTION } from "../collections/index.js";
import { ERROR_IDS } from "../constants/error-ids.js";
import { type MemberDocument } from "../types/member-document.js";
import type { ProfileData } from "../types/profile-data.js";
import { serializeToMarkdown } from "../write-profile/index.js";
import { validateProfileData } from "../write-profile/validation.js";

export type { ProfileData } from "../types/profile-data.js";

export async function handleCreateProfile(
  request: CallableRequest<ProfileData>,
  [GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID]: [
    string,
    string,
    string,
  ],
) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }
  const uid = request.auth.uid;
  logger.info(`Create profile request initiated for user: ${uid}`);

  validateProfileData(request.data);

  const database = getFirestore();
  const memberReference = database.collection(MEMBERS_COLLECTION).doc(uid);

  let memberData: MemberDocument;
  let slug: string;

  try {
    const memberDocument = await memberReference.get();

    if (!memberDocument.exists) {
      throw new HttpsError(
        "not-found",
        "No member document found for this user.",
      );
    }

    const data = memberDocument.data() as MemberDocument | undefined;
    if (!data) {
      throw new HttpsError("not-found", "Member document data is empty.");
    }

    memberData = data;

    if (!memberData.membershipActive) {
      throw new HttpsError(
        "failed-precondition",
        "User does not have an active membership.",
      );
    }

    if (!memberData.slug) {
      throw new HttpsError(
        "failed-precondition",
        "Profile slug not found. User must create a slug first.",
      );
    }

    slug = memberData.slug;
  } catch (error: unknown) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to read member document in createProfile", {
      errorId: ERROR_IDS.CREATE_PROFILE_FIRESTORE_READ_ERROR,
      uid,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to retrieve member information. Please try again.",
    );
  }

  const filePath = `hugo/content/doulas/${slug}/index.md`;

  // Hardcoded for this deployment. In forks/test environments, use environment
  // variables GITHUB_OWNER/GITHUB_REPO or modify these constants.
  const owner = "markgoho";
  const repo = "doula-cooperative";

  // Create initial metadata for new profile
  const now = new Date().toISOString();
  const initialMetadata = {
    date: now,
    createdOn: now,
    updatedOn: now,
    // New profiles start as draft to prevent accidental premature publication
    draft: true,
  };

  // Serialize the profile data to markdown format
  let content: string;
  try {
    content = serializeToMarkdown(request.data, initialMetadata);
  } catch (error: unknown) {
    logger.error("Failed to serialize profile data", {
      errorId: ERROR_IDS.CREATE_PROFILE_SERIALIZATION_ERROR,
      uid,
      slug,
      error,
    });
    throw new HttpsError(
      "invalid-argument",
      "Profile data could not be processed. Please check your input.",
    );
  }

  // Authenticate as the GitHub App
  let octokit;
  try {
    const app = new App({
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_PRIVATE_KEY,
    });
    octokit = await app.getInstallationOctokit(
      Number.parseInt(GITHUB_INSTALLATION_ID),
    );
  } catch (error: unknown) {
    logger.error("GitHub authentication failed", {
      errorId: ERROR_IDS.CREATE_PROFILE_GITHUB_AUTH_FAILED,
      uid,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to authenticate with GitHub. Please try again later.",
    );
  }

  // Create the file on GitHub
  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Create profile for ${request.data.title}`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: "trunk",
    });

    logger.info(`Successfully created ${filePath} for user ${uid}`);
    return { success: true };
  } catch (error: unknown) {
    // Type guard for GitHub API errors
    const isGitHubError = (
      value: unknown,
    ): value is {
      status: number;
      response?: { headers?: Record<string, string> };
    } => {
      return typeof value === "object" && value !== null && "status" in value;
    };

    // Type guard for rate limit errors specifically
    const isRateLimitError = (
      value: unknown,
    ): value is {
      status: number;
      response: { headers: Record<string, string> };
    } => {
      return (
        isGitHubError(value) &&
        value.status === 403 &&
        value.response?.headers?.["x-ratelimit-remaining"] === "0"
      );
    };

    // Check for GitHub API rate limiting
    if (isRateLimitError(error)) {
      logger.error("GitHub API rate limit exceeded", {
        errorId: ERROR_IDS.CREATE_PROFILE_GITHUB_RATE_LIMIT,
        uid,
        slug,
        rateLimitReset: error.response.headers["x-ratelimit-reset"],
        error,
      });
      throw new HttpsError(
        "resource-exhausted",
        "Too many profile creations. Please try again later.",
      );
    }

    // Check for file already exists (409 conflict)
    if (isGitHubError(error) && error.status === 409) {
      logger.error("GitHub file already exists", {
        errorId: ERROR_IDS.CREATE_PROFILE_GITHUB_CONFLICT,
        uid,
        slug,
        filePath,
        error,
      });
      throw new HttpsError(
        "already-exists",
        "Profile file already exists. Use the update function instead.",
      );
    }

    // Handle non-GitHub errors separately
    if (!isGitHubError(error)) {
      logger.error("Error creating profile - non-GitHub error", {
        errorId: ERROR_IDS.CREATE_PROFILE_PROCESSING_ERROR,
        uid,
        slug,
        filePath,
        error,
      });
      throw new HttpsError(
        "internal",
        "Failed to process profile creation. Please try again.",
        error as Error,
      );
    }

    // Generic GitHub API error (only reaches here if isGitHubError is true)
    logger.error("Error interacting with GitHub API", {
      errorId: ERROR_IDS.CREATE_PROFILE_GITHUB_GENERIC,
      uid,
      slug,
      filePath,
      githubStatus: error.status,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to create the file on GitHub.",
      error instanceof Error ? error : new Error(JSON.stringify(error)),
    );
  }
}
