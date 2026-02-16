import { logger } from "firebase-functions/v2";
import { load } from "js-yaml";
import { App } from "octokit";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { GITHUB_OWNER, GITHUB_REPO } from "../../../constants/github-config.js";
import {
  HttpError,
  NotFoundError,
} from "../../../shared-api/errors/http-error.js";
import type { ProfileData } from "../../schemas/profile-schemas.js";
import type { ProfileMemberService } from "../member/interface.js";
import type { ReadProfileResponse } from "./interface.js";

/**
 * Parse profile markdown content into structured ProfileData.
 * Extracts YAML front matter and markdown body.
 */
function parseProfileMarkdown(content: string, slug: string): ProfileData {
  // Parse front matter (YAML between --- markers)
  const frontMatterMatch = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);

  if (!frontMatterMatch) {
    logger.error("No front matter found in profile content", {
      errorId: ERROR_IDS.API_PROFILE_READ_FAILED,
      slug,
    });
    throw new HttpError(
      "Profile data is corrupted. Please contact support.",
      500,
    );
  }

  const [, frontMatter, bodyContent] = frontMatterMatch;

  if (!frontMatter || bodyContent === undefined) {
    logger.error("Invalid front matter format", {
      errorId: ERROR_IDS.API_PROFILE_READ_FAILED,
      slug,
    });
    throw new HttpError(
      "Profile data format is invalid. Please contact support.",
      500,
    );
  }

  // Parse YAML front matter
  let parsed: Partial<ProfileData>;
  try {
    parsed = load(frontMatter) as Partial<ProfileData>;
  } catch (error) {
    logger.error("Failed to parse YAML front matter", {
      errorId: ERROR_IDS.API_PROFILE_READ_FAILED,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError(
      "Profile data could not be parsed. Please contact support.",
      500,
    );
  }

  // Build ProfileData object from parsed YAML
  const data: ProfileData = {
    title: parsed.title ?? "",
    bio: bodyContent.trim(),
    draft: parsed.draft ?? false,
  };

  if (parsed.credentials) {
    data.credentials = parsed.credentials;
  }

  if (parsed.pronouns) {
    data.pronouns = parsed.pronouns;
  }

  if (parsed.tags) {
    data.tags = parsed.tags;
  }

  if (parsed.contact) {
    data.contact = parsed.contact;
  }

  return data;
}

/**
 * Get authenticated Octokit instance using GitHub App credentials.
 */
async function getOctokit() {
  const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
  const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
  const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
    throw new HttpError("GitHub configuration is missing", 500);
  }

  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });

  return app.getInstallationOctokit(Number.parseInt(GITHUB_INSTALLATION_ID));
}

const IMAGEKIT_BASE_URL = "https://ik.imagekit.io/doulacoop";

/**
 * Read a profile's content and image from GitHub and Firestore.
 */
export async function readProfile(options: {
  slug: string;
  profileMemberService: ProfileMemberService;
}): Promise<ReadProfileResponse> {
  const { slug, profileMemberService } = options;
  const filePath = `hugo/content/doulas/${slug}/index.md`;

  const octokit = await getOctokit();

  try {
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
    });

    if (!("content" in fileData)) {
      throw new Error("Path did not resolve to a file.");
    }

    const content = Buffer.from(fileData.content, "base64").toString("utf8");

    const profileData = parseProfileMarkdown(content, slug);

    const member = await profileMemberService.getMemberBySlug(slug);
    const imagekitPath = member?.imagekitPath;

    const image = imagekitPath
      ? `${IMAGEKIT_BASE_URL}/${imagekitPath}`
      : undefined;

    return {
      ...profileData,
      ...(image !== undefined && { image }),
    };
  } catch (error) {
    const isGitHubError = (value: unknown): value is { status: number } => {
      return typeof value === "object" && value !== null && "status" in value;
    };

    if (isGitHubError(error) && error.status === 404) {
      logger.warn("Profile not found on GitHub", {
        errorId: ERROR_IDS.API_PROFILE_NOT_FOUND,
        slug,
        filePath,
      });
      throw new NotFoundError("Profile not found");
    }

    logger.error("Failed to read profile from GitHub", {
      errorId: ERROR_IDS.API_GITHUB_READ_FAILED,
      slug,
      filePath,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to read profile from GitHub", 500);
  }
}
