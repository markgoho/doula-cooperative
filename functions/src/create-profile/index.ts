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
  // 1. Check for Firebase authenticated user
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }
  const uid = request.auth.uid;
  logger.info(`Create profile request initiated for user: ${uid}`);

  // 2. Validate input data
  validateProfileData(request.data);

  // 3. Get the member document to check membership and slug
  const database = getFirestore();
  const memberReference = database.collection(MEMBERS_COLLECTION).doc(uid);
  const memberDocument = await memberReference.get();

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

  // Check if user has an active membership
  if (!memberData.membershipActive) {
    throw new HttpsError(
      "failed-precondition",
      "User does not have an active membership.",
    );
  }

  // Check if user has a slug
  const slug = memberData.slug;
  if (!slug) {
    throw new HttpsError(
      "failed-precondition",
      "Profile slug not found. User must create a slug first.",
    );
  }

  const filePath = `hugo/content/doulas/${slug}/index.md`;

  // 4. Authenticate as the GitHub App
  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });
  const octokit = await app.getInstallationOctokit(
    Number.parseInt(GITHUB_INSTALLATION_ID),
  );

  // These repository values can be hardcoded since they're specific to this project
  const owner = "markgoho";
  const repo = "doula-cooperative";

  try {
    // 5. Create initial metadata for new profile
    const now = new Date().toISOString();
    const initialMetadata = {
      date: now,
      createdOn: now,
      updatedOn: now,
      draft: true, // New profiles start as draft
    };

    // 6. Serialize the profile data to markdown format
    const content = serializeToMarkdown(request.data, initialMetadata);

    // 7. Create the file on GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Create profile for ${request.data.title}`,
      content: Buffer.from(content, "utf8").toString("base64"),
      // No SHA needed for new file creation
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
