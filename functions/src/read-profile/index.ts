import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { App } from "octokit";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../collections/index.js";
import { fetchProfileFromGitHub } from "../utils/fetch-profile-from-github.js";

export async function handleReadProfile(
  request: CallableRequest,
  [GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID]: string[],
) {
  // Validate GitHub secrets
  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
    throw new HttpsError("internal", "Missing GitHub secrets.");
  }

  // 1. Check for Firebase authenticated user
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }
  const uid = request.auth.uid;
  logger.info(`Read request initiated for user: ${uid}`);

  // 2. Get the Hugo file path from the members collection
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

  // Check if user has a profile (indicated by presence of slug)
  const slug = memberData.slug;
  if (!slug) {
    throw new HttpsError(
      "failed-precondition",
      "User does not have a profile yet.",
    );
  }

  // 3. Authenticate as the GitHub App
  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });
  const octokit = await app.getInstallationOctokit(
    Number.parseInt(GITHUB_INSTALLATION_ID),
  );

  // 4. Fetch profile content and image from GitHub
  try {
    const { content, image } = await fetchProfileFromGitHub(slug, octokit);

    logger.info(`Successfully read profile for user ${uid} (slug: ${slug})`);
    return { content, image };
  } catch (error) {
    logger.error("Error interacting with GitHub API", error);
    throw new HttpsError(
      "internal",
      "Failed to read the file from GitHub.",
      error as Error,
    );
  }
}
