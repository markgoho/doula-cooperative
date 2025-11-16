import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { type CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { App } from "octokit";
import { MEMBERS_COLLECTION } from "../constants/index.js";
import { type MemberDocument } from "../types/member-document.js";
import { verifyAdmin } from "./verify-admin.js";

export interface AdminReadProfileRequest {
  uid: string;
}

export interface AdminReadProfileResponse {
  content: string;
  image?: string;
  slug: string;
}

export async function handleAdminReadMemberProfile(
  data: AdminReadProfileRequest,
  context: CallableRequest,
  [GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID]: string[],
): Promise<AdminReadProfileResponse> {
  // 1. Verify admin privileges
  verifyAdmin(context);

  // Validate GitHub secrets
  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
    throw new HttpsError("internal", "Missing GitHub secrets.");
  }

  const { uid } = data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "uid is required");
  }

  logger.info(`Admin read profile request for user: ${uid}`);

  // 2. Get the member document
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

  // Check if user has a profile
  if (!memberData.hasProfile) {
    throw new HttpsError(
      "failed-precondition",
      "User does not have a profile yet.",
    );
  }

  const slug = memberData.slug;

  if (!slug) {
    throw new HttpsError(
      "failed-precondition",
      "User has profile flag but no slug.",
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
  const owner = "markgoho";
  const repo = "doula-cooperative";

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

    // 5. Decode the content
    const content = Buffer.from(fileData.content, "base64").toString("utf8");

    // Construct the full GitHub URL for the image
    let image: string | undefined;

    const imagePath = `hugo/content/doulas/${slug}/${slug}.avif`;
    const imageUrl = `https://raw.githubusercontent.com/markgoho/doula-cooperative/refs/heads/trunk/${imagePath}`;

    // Check if image exists
    try {
      const { data: imageData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: imagePath,
      });

      if ("content" in imageData) {
        image = imageUrl;
      }
    } catch {
      // Image doesn't exist, which is fine
      logger.info(`Profile image not found for user ${slug}`);
    }

    logger.info(`Admin successfully read profile ${filePath} for user ${uid}`);
    return {
      content,
      slug,
      ...(image !== undefined && { image }),
    };
  } catch (error) {
    logger.error("Error interacting with GitHub API", error);
    throw new HttpsError(
      "internal",
      "Failed to read the profile from GitHub.",
      error as Error,
    );
  }
}
