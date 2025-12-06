import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { App } from "octokit";
import { MEMBERS_COLLECTION } from "../collections/index.js";
import { ERROR_IDS } from "../constants/error-ids.js";
import { type MemberDocument } from "../types/member-document.js";
import type { ProfileData } from "../types/profile-data.js";
import { validateProfileData } from "./validation.js";

export type { ProfileData } from "../types/profile-data.js";

/**
 * Remove protocol from URLs for Hugo front matter.
 * Hugo adds protocols automatically in templates, so storing without protocol
 * keeps data clean and protocol-agnostic.
 */
function stripUrlProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export function serializeToMarkdown(
  data: ProfileData,
  existingMetadata?: {
    date?: string;
    createdAt?: string;
    createdOn?: string;
    updatedAt?: string;
    updatedOn?: string;
    draft?: boolean;
  },
): string {
  const updatedAt = new Date().toISOString();

  // Format tags as YAML array
  const tagsYaml =
    data.tags && data.tags.length > 0
      ? `tags:\n${data.tags.map((tag: string) => `  - "${tag}"`).join("\n")}`
      : "";

  // Format contact information
  // Filter out undefined values before checking if contact object has data
  const hasContactData =
    data.contact !== undefined &&
    Object.values(data.contact).some(v => typeof v === "string" && v !== "");
  const contactYaml =
    hasContactData && data.contact
      ? `contact:
${data.contact.business_name ? `  business_name: ${data.contact.business_name}\n` : ""}${data.contact.website ? `  website: ${stripUrlProtocol(data.contact.website)}\n` : ""}${data.contact.phone ? `  phone: ${data.contact.phone}\n` : ""}${data.contact.email ? `  email: "${data.contact.email}"\n` : ""}`.trimEnd()
      : "";

  const createdAt = existingMetadata?.createdAt ?? existingMetadata?.createdOn;
  const finalUpdatedAt = existingMetadata?.updatedAt ?? existingMetadata?.updatedOn ?? updatedAt;

  return `---
title: "${data.title}"
${existingMetadata?.date ? `date: ${existingMetadata.date}` : ""}
${createdAt ? `createdAt: ${createdAt}` : ""}
updatedAt: ${finalUpdatedAt}
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

export function parseExistingMetadata(content: string): {
  date?: string;
  createdAt?: string;
  createdOn?: string;
  updatedAt?: string;
  updatedOn?: string;
  draft?: boolean;
} {
  const frontMatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);

  if (!frontMatterMatch?.[1]) {
    logger.warn(
      "No front matter found in existing profile content - metadata may be lost",
      {
        errorId: ERROR_IDS.WRITE_PROFILE_METADATA_PARSE_FAILED,
        contentPreview: content.slice(0, 200),
      },
    );
    return {};
  }

  const frontMatter = frontMatterMatch[1];
  const metadata: {
    date?: string;
    createdAt?: string;
    createdOn?: string;
    updatedAt?: string;
    updatedOn?: string;
    draft?: boolean;
  } = {};

  const dateMatch = /^date:\s*(.+)$/m.exec(frontMatter);
  if (dateMatch?.[1]) {
    metadata.date = dateMatch[1].trim();
  }

  // Support both new (createdAt) and old (createdOn) field names
  const createdAtMatch = /^createdAt:\s*(.+)$/m.exec(frontMatter);
  if (createdAtMatch?.[1]) {
    metadata.createdAt = createdAtMatch[1].trim();
  }

  const createdOnMatch = /^createdOn:\s*(.+)$/m.exec(frontMatter);
  if (createdOnMatch?.[1]) {
    metadata.createdOn = createdOnMatch[1].trim();
  }

  // Support both new (updatedAt) and old (updatedOn) field names
  const updatedAtMatch = /^updatedAt:\s*(.+)$/m.exec(frontMatter);
  if (updatedAtMatch?.[1]) {
    metadata.updatedAt = updatedAtMatch[1].trim();
  }

  const updatedOnMatch = /^updatedOn:\s*(.+)$/m.exec(frontMatter);
  if (updatedOnMatch?.[1]) {
    metadata.updatedOn = updatedOnMatch[1].trim();
  }

  const draftMatch = /^draft:\s*(.+)$/m.exec(frontMatter);
  if (draftMatch?.[1]) {
    metadata.draft = draftMatch[1].trim() === "true";
  }

  return metadata;
}

export async function handleWriteProfile(
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
  logger.info(`Write request initiated for user: ${uid}`);

  validateProfileData(request.data);

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

  if (!memberData.membershipActive) {
    throw new HttpsError(
      "failed-precondition",
      "User does not have an active membership.",
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

  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });
  const octokit = await app.getInstallationOctokit(
    Number.parseInt(GITHUB_INSTALLATION_ID),
  );

  // Hardcoded for this deployment. In forks/test environments, use environment
  // variables GITHUB_OWNER/GITHUB_REPO or modify these constants.
  const owner = "markgoho";
  const repo = "doula-cooperative";

  try {
    // Fetch the existing file to get its SHA and preserve metadata
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
    });

    if (!("content" in fileData)) {
      throw new Error("Path did not resolve to a file.");
    }

    const existingContent = Buffer.from(fileData.content, "base64").toString(
      "utf8",
    );
    const existingMetadata = parseExistingMetadata(existingContent);

    const newContent = serializeToMarkdown(request.data, existingMetadata);

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
        errorId: ERROR_IDS.WRITE_PROFILE_GITHUB_RATE_LIMIT,
        uid,
        slug,
        rateLimitReset: error.response.headers["x-ratelimit-reset"],
        error,
      });
      throw new HttpsError(
        "resource-exhausted",
        "Too many profile updates. Please try again later.",
      );
    }

    // Check for other GitHub API errors
    if (isGitHubError(error) && error.status === 404) {
      logger.error("GitHub file not found", {
        errorId: ERROR_IDS.WRITE_PROFILE_GITHUB_NOT_FOUND,
        uid,
        slug,
        filePath,
        error,
      });
      throw new HttpsError(
        "not-found",
        "Profile file not found. Please contact support.",
      );
    }

    if (isGitHubError(error) && error.status === 409) {
      logger.error("GitHub conflict - file was modified", {
        errorId: ERROR_IDS.WRITE_PROFILE_GITHUB_CONFLICT,
        uid,
        slug,
        filePath,
        error,
      });
      throw new HttpsError(
        "failed-precondition",
        "Profile was modified by another process. Please refresh and try again.",
      );
    }

    // Handle non-GitHub errors separately
    if (!isGitHubError(error)) {
      logger.error("Error updating profile - non-GitHub error", {
        errorId: ERROR_IDS.WRITE_PROFILE_PROCESSING_ERROR,
        uid,
        slug,
        filePath,
        error,
      });
      throw new HttpsError(
        "internal",
        "Failed to process profile update. Please try again.",
        error as Error,
      );
    }

    // Generic GitHub API error (only reaches here if isGitHubError is true)
    logger.error("Error interacting with GitHub API", {
      errorId: ERROR_IDS.WRITE_PROFILE_GITHUB_GENERIC,
      uid,
      slug,
      filePath,
      githubStatus: error.status,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to write the file to GitHub.",
      error instanceof Error ? error : new Error(JSON.stringify(error)),
    );
  }
}
