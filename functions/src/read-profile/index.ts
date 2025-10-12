import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { App } from "octokit";
import { MEMBERS_COLLECTION } from "../constants";
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

  // Check if user has a profile
  if (!memberData.hasProfile) {
    throw new HttpsError(
      "failed-precondition",
      "User does not have a profile yet.",
    );
  }

  const slug = memberData.slug;

  if (!slug) {
    // User exists in members collection but doesn't have a slug yet (no GitHub profile)
    throw new HttpsError(
      "not-found",
      "Profile not found. User may need to claim their existing membership first.",
    );
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
    // Fetch the markdown content
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

    // Construct the full GitHub URL for the image
    let image: string | undefined;

    const imagePath = `hugo/content/doulas/${slug}/${slug}.avif`;
    const imageUrl = `https://raw.githubusercontent.com/markgoho/doula-cooperative/refs/heads/trunk/${imagePath}`;

    // Check if image exists by making a request to the URL
    try {
      const { data: imageData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: imagePath,
      });

      if ("content" in imageData) {
        // Return the full GitHub URL for the image
        image = imageUrl;
      }
    } catch {
      // Image doesn't exist, which is fine - continue without it
      logger.info(`Profile image not found for user ${slug}`);
    }

    logger.info(`Successfully read ${filePath} for user ${uid}`);
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
