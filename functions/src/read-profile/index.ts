import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { App } from "octokit";
import { type MemberDocument } from "../types/member-document";

export async function handleReadProfile(
  request: CallableRequest,
  [GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID]: string[],
) {
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
  const memberReference = database.collection("members").doc(uid);
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
  const slug = memberData.slug;

  if (!slug) {
    throw new HttpsError("not-found", "No slug found for this user.");
  }

  const filePath = `hugo/content/doulas/${slug}/index.md`;

  // 3. Authenticate as the GitHub App
  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });
  const octokit = await app.getInstallationOctokit(
    Number.parseInt(GITHUB_INSTALLATION_ID),
  );

  // 4. Use the GitHub API to fetch the file content
  const owner = "markgoho"; // <-- IMPORTANT: Change this
  const repo = "doula-cooperative"; // <-- IMPORTANT: Change this

  try {
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    // Safety check to ensure we got a file and not a directory
    if (!("content" in fileData)) {
      throw new Error("Path did not resolve to a file.");
    }

    // 5. Decode the content and return it
    const content = Buffer.from(fileData.content, "base64").toString("utf8");
    logger.info(`Successfully read ${filePath} for user ${uid}`);
    return { content };
  } catch (error) {
    logger.error("Error interacting with GitHub API", error);
    throw new HttpsError(
      "internal",
      "Failed to read the file from GitHub.",
      error as Error,
    );
  }
}
