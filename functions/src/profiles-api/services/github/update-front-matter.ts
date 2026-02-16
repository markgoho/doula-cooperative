import { logger } from "firebase-functions/v2";
import { App } from "octokit";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../../constants/github-config.js";
import { HttpError } from "../../../shared-api/errors/http-error.js";

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

/**
 * Fetch a profile's raw content and SHA from GitHub.
 */
async function fetchProfileFile(slug: string) {
  const octokit = await getOctokit();
  const filePath = `hugo/content/doulas/${slug}/index.md`;

  const { data: fileData } = await octokit.rest.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: filePath,
  });

  if (!("sha" in fileData) || !("content" in fileData)) {
    throw new Error("Path did not resolve to a file.");
  }

  const content = Buffer.from(fileData.content, "base64").toString("utf8");
  return { content, sha: fileData.sha, filePath, octokit };
}

/**
 * Parse front matter and body from markdown content.
 */
function parseFrontMatter(content: string): {
  frontMatter: string;
  body: string;
} {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);
  if (!match?.[1] || !match[2]) {
    throw new Error("Could not parse existing front matter");
  }
  return { frontMatter: match[1], body: match[2] };
}

/**
 * Add or update imagekit_path in a profile's GitHub front matter.
 */
export async function updateFrontMatterImagePath(options: {
  slug: string;
  imagekitPath: string;
}): Promise<void> {
  const { slug, imagekitPath } = options;

  try {
    const { content, sha, filePath, octokit } = await fetchProfileFile(slug);
    const { frontMatter, body } = parseFrontMatter(content);

    const imagekitPathLine = `imagekit_path: "${imagekitPath}"`;
    const newFrontMatter = /^imagekit_path:/m.test(frontMatter)
      ? frontMatter.replace(/^imagekit_path:.*$/m, imagekitPathLine)
      : `${frontMatter.trim()}\n${imagekitPathLine}`;

    const newContent = `---\n${newFrontMatter}\n---\n${body}`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: `Update profile image for ${slug}`,
      content: Buffer.from(newContent, "utf8").toString("base64"),
      sha,
      branch: GITHUB_BRANCH,
    });

    logger.info("Updated GitHub front matter with imagekit_path", {
      slug,
      imagekitPath,
    });
  } catch (error: unknown) {
    logger.error("Failed to update GitHub front matter imagekit_path", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_GITHUB_FAILED,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Remove imagekit_path from a profile's GitHub front matter.
 */
export async function removeFrontMatterImagePath(options: {
  slug: string;
}): Promise<void> {
  const { slug } = options;

  try {
    const { content, sha, filePath, octokit } = await fetchProfileFile(slug);
    const { frontMatter, body } = parseFrontMatter(content);

    const newFrontMatter = frontMatter
      .split("\n")
      .filter(line => !line.startsWith("imagekit_path:"))
      .join("\n");

    if (newFrontMatter === frontMatter) {
      logger.info("No imagekit_path in front matter, skipping GitHub update", {
        slug,
      });
      return;
    }

    const newContent = `---\n${newFrontMatter}\n---\n${body}`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: `Remove profile image for ${slug}`,
      content: Buffer.from(newContent, "utf8").toString("base64"),
      sha,
      branch: GITHUB_BRANCH,
    });

    logger.info("Removed imagekit_path from GitHub front matter", { slug });
  } catch (error: unknown) {
    logger.error("Failed to remove imagekit_path from GitHub front matter", {
      errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_FAILED,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
