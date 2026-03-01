import { logger } from "firebase-functions/v2";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../../constants/github-config.js";
import { HttpError } from "../../../shared-api/errors/http-error.js";
import { getOctokit } from "./get-octokit.js";

/**
 * Set `draft: true` on an existing Hugo profile via the GitHub API.
 *
 * Reads the profile file, modifies the YAML frontmatter to set `draft: true`,
 * and writes it back. This hides the profile from the public site while
 * preserving the file for easy reinstatement.
 */
export async function draftProfile(options: {
  slug: string;
}): Promise<{ success: true }> {
  const { slug } = options;
  const filePath = `hugo/content/doulas/${slug}/index.md`;

  const octokit = await getOctokit();

  const { data: fileData } = await octokit.rest.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: filePath,
  });

  if (!("content" in fileData)) {
    throw new Error("Path did not resolve to a file.");
  }

  const content = Buffer.from(fileData.content, "base64").toString("utf8");

  // Parse frontmatter boundaries
  const frontMatterMatch = /^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/.exec(
    content,
  );

  if (!frontMatterMatch) {
    throw new HttpError("Profile frontmatter could not be parsed", 500);
  }

  const [, opening, frontMatter, closing, body] = frontMatterMatch;

  if (!opening || !frontMatter || !closing || body === undefined) {
    throw new HttpError("Profile frontmatter format is invalid", 500);
  }

  // Update or insert draft: true in the frontmatter
  const updatedFrontMatter = /^draft:\s*.+$/m.test(frontMatter)
    ? frontMatter.replace(/^draft:\s*.+$/m, "draft: true")
    : `${frontMatter}\ndraft: true`;

  const updatedContent = `${opening}${updatedFrontMatter}${closing}${body}`;

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: filePath,
    message: `Set profile to draft: ${slug}`,
    content: Buffer.from(updatedContent, "utf8").toString("base64"),
    sha: fileData.sha,
    branch: GITHUB_BRANCH,
  });

  logger.info("Successfully set profile to draft", { slug });

  return { success: true };
}
