import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { App } from "octokit";
import { MEMBERS_COLLECTION } from "../constants";
import { type MemberDocument } from "../types/member-document";

export interface ProfileData {
  title: string;
  credentials?: string;
  tags?: string[];
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    business_name?: string;
  };
  bio: string;
}

function stripUrlProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function serializeToMarkdown(
  data: ProfileData,
  existingMetadata?: {
    date?: string;
    createdOn?: string;
    updatedOn?: string;
    draft?: boolean;
  },
): string {
  const updatedOn = new Date().toISOString();

  // Format tags as YAML array
  const tagsYaml =
    data.tags && data.tags.length > 0
      ? `tags:\n${data.tags.map(tag => `  - "${tag}"`).join("\n")}`
      : "";

  // Format contact information
  const contactYaml =
    data.contact && Object.keys(data.contact).length > 0
      ? `contact:
${data.contact.business_name ? `  business_name: ${data.contact.business_name}\n` : ""}${data.contact.website ? `  website: ${stripUrlProtocol(data.contact.website)}\n` : ""}${data.contact.phone ? `  phone: ${data.contact.phone}\n` : ""}${data.contact.email ? `  email: "${data.contact.email}"\n` : ""}`.trimEnd()
      : "";

  return `---
title: "${data.title}"
${existingMetadata?.date ? `date: ${existingMetadata.date}` : ""}
${existingMetadata?.createdOn ? `createdOn: ${existingMetadata.createdOn}` : ""}
updatedOn: ${updatedOn}
type: "doulas"
${data.credentials ? `credentials: "${data.credentials}"` : ""}
${tagsYaml}
${contactYaml}
${existingMetadata?.draft === undefined ? "" : `draft: ${existingMetadata.draft}`}
---

${data.bio.trim()}
`
    .split("\n")
    .filter(line => line === "" || line.trim() !== "")
    .join("\n");
}

function parseExistingMetadata(content: string): {
  date?: string;
  createdOn?: string;
  updatedOn?: string;
  draft?: boolean;
} {
  const frontMatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);

  if (!frontMatterMatch) {
    return {};
  }

  const [, frontMatter] = frontMatterMatch;
  const metadata: {
    date?: string;
    createdOn?: string;
    updatedOn?: string;
    draft?: boolean;
  } = {};

  const dateMatch = /^date:\s*(.+)$/m.exec(frontMatter);
  if (dateMatch) {
    metadata.date = dateMatch[1].trim();
  }

  const createdOnMatch = /^createdOn:\s*(.+)$/m.exec(frontMatter);
  if (createdOnMatch) {
    metadata.createdOn = createdOnMatch[1].trim();
  }

  const updatedOnMatch = /^updatedOn:\s*(.+)$/m.exec(frontMatter);
  if (updatedOnMatch) {
    metadata.updatedOn = updatedOnMatch[1].trim();
  }

  const draftMatch = /^draft:\s*(.+)$/m.exec(frontMatter);
  if (draftMatch) {
    metadata.draft = draftMatch[1].trim() === "true";
  }

  return metadata;
}

export async function handleWriteProfile(
  request: CallableRequest<ProfileData>,
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
  logger.info(`Write request initiated for user: ${uid}`);

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

  const owner = "markgoho"; // <-- IMPORTANT: Change this
  const repo = "doula-cooperative"; // <-- IMPORTANT: Change this

  try {
    // First, fetch the existing file to get its SHA and preserve metadata
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    // Safety check to ensure we got a file and not a directory
    if (!("content" in fileData)) {
      throw new Error("Path did not resolve to a file.");
    }

    // Parse existing content to preserve metadata
    const existingContent = Buffer.from(fileData.content, "base64").toString(
      "utf8",
    );
    const existingMetadata = parseExistingMetadata(existingContent);

    // 4. Serialize the profile data to markdown format
    const newContent = serializeToMarkdown(request.data, existingMetadata);

    // 5. Update the file on GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Update profile for ${request.data.title}`,
      content: Buffer.from(newContent, "utf8").toString("base64"),
      sha: fileData.sha,
      branch: "trunk",
    });

    logger.info(`Successfully updated ${filePath} for user ${uid}`);
    return { success: true };
  } catch (error) {
    logger.error("Error interacting with GitHub API", error);
    throw new HttpsError(
      "internal",
      "Failed to write the file to GitHub.",
      error as Error,
    );
  }
}
