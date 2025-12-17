import * as logger from "firebase-functions/logger";
import { type Octokit } from "octokit";
import { isGitHubError, isRateLimitError } from "./github-error.js";

export interface BatchDeleteOptions {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
  filePaths: string[];
  commitMessage: string;
}

export interface BatchDeleteResult {
  success: boolean;
  deletedFiles: string[];
  commitSha?: string;
}

/**
 * Batch delete multiple files from a GitHub repository in a single commit.
 * Uses Git's low-level Tree API to create an atomic commit with multiple deletions.
 *
 * @param options - Configuration for the batch delete operation
 * @returns Result containing deleted files and commit SHA
 * @throws Error if GitHub API calls fail (rate limit, invalid branch, etc.)
 */
export async function batchDeleteFiles(
  options: BatchDeleteOptions,
): Promise<BatchDeleteResult> {
  const { octokit, owner, repo, branch, filePaths, commitMessage } = options;

  // 1. Get current branch reference
  let branchReference;
  try {
    const referenceResponse = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    branchReference = referenceResponse.data;
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      throw error;
    }
    logger.error("Failed to get branch reference", {
      owner,
      repo,
      branch,
      error,
    });
    throw new Error(`Failed to get branch reference: ${branch}`);
  }

  const currentCommitSha = branchReference.object.sha;

  // 2. Check which files exist and collect their SHAs
  const filesToDelete: { path: string; sha: string }[] = [];

  for (const filePath of filePaths) {
    try {
      const { data: file } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
      });

      if ("sha" in file) {
        filesToDelete.push({ path: filePath, sha: file.sha });
      }
    } catch (error: unknown) {
      // 404 is expected - file doesn't exist, skip it
      if (isGitHubError(error) && error.status === 404) {
        continue;
      }

      // Rate limit error - throw immediately
      if (isRateLimitError(error)) {
        throw error;
      }

      // Authentication/authorization errors - fail immediately
      if (
        isGitHubError(error) &&
        (error.status === 401 || error.status === 403)
      ) {
        logger.error(
          `GitHub authentication/authorization failed while checking file`,
          {
            owner,
            repo,
            filePath,
            status: error.status,
            error,
          },
        );
        throw new Error(
          `GitHub authentication failed. Please check app credentials.`,
        );
      }

      // Server errors (5xx) - fail immediately
      if (isGitHubError(error) && error.status >= 500) {
        logger.error(`GitHub server error while checking file`, {
          owner,
          repo,
          filePath,
          status: error.status,
          error,
        });
        throw new Error(
          `GitHub API is experiencing issues. Please try again later.`,
        );
      }

      // Unknown errors - fail immediately
      logger.error(`Unexpected error checking file existence: ${filePath}`, {
        owner,
        repo,
        filePath,
        error,
      });
      throw new Error(
        `Failed to verify files for deletion due to unexpected error`,
      );
    }
  }

  // 3. Return early if no files to delete
  if (filesToDelete.length === 0) {
    logger.info("No files to delete", { filePaths });
    return {
      success: true,
      deletedFiles: [],
    };
  }

  logger.info(`Found ${filesToDelete.length} files to delete`, {
    files: filesToDelete.map(f => f.path),
  });

  // 4. Get current commit and tree
  let baseTreeSha: string;
  try {
    const commitResponse = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: currentCommitSha,
    });
    baseTreeSha = commitResponse.data.tree.sha;
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      throw error;
    }
    logger.error("Failed to get commit", {
      owner,
      repo,
      commitSha: currentCommitSha,
      error,
    });
    throw new Error("Failed to get current commit");
  }

  // 5. Create new tree with files marked for deletion
  // Use base_tree and mark files for deletion by setting sha to null
  logger.info("Marking files for deletion:", {
    paths: filesToDelete.map(f => f.path),
  });

  const treeUpdates = filesToDelete.map(f => ({
    path: f.path,
    mode: "100644" as const,
    type: "blob" as const,
    // eslint-disable-next-line unicorn/no-null -- GitHub API requires null to delete files
    sha: null,
  }));

  let newTreeSha: string;
  try {
    const newTreeResponse = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: treeUpdates,
    });
    newTreeSha = newTreeResponse.data.sha;
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      throw error;
    }
    logger.error("Failed to create new tree", {
      owner,
      repo,
      error,
    });
    throw new Error("Failed to create new tree");
  }

  logger.info("Tree SHAs:", {
    baseTreeSha,
    newTreeSha,
    areIdentical: baseTreeSha === newTreeSha,
  });

  // Check if tree actually changed
  if (baseTreeSha === newTreeSha) {
    logger.warn("New tree is identical to base tree - no changes to commit", {
      baseTreeSha,
      filesToDelete: filesToDelete.map(f => f.path),
    });
    return {
      success: true,
      deletedFiles: [],
    };
  }

  // 7. Create commit with new tree
  let newCommitSha: string;
  try {
    const commitResponse = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTreeSha,
      parents: [currentCommitSha],
    });
    newCommitSha = commitResponse.data.sha;
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      throw error;
    }
    logger.error("Failed to create commit", {
      owner,
      repo,
      treeSha: newTreeSha,
      parentSha: currentCommitSha,
      error,
    });
    throw new Error("Failed to create commit");
  }

  // 8. Update branch reference
  try {
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommitSha,
      force: false, // Fail if there are concurrent modifications
    });
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      throw error;
    }
    logger.error("Failed to update branch reference", {
      owner,
      repo,
      branch,
      newCommitSha,
      error,
    });
    throw new Error(
      "Failed to update branch because the profile was modified by another operation. Please try again.",
    );
  }

  const deletedFilePaths = filesToDelete.map(f => f.path);
  logger.info("Successfully batch deleted files", {
    owner,
    repo,
    branch,
    deletedFiles: deletedFilePaths,
    commitSha: newCommitSha,
  });

  return {
    success: true,
    deletedFiles: deletedFilePaths,
    commitSha: newCommitSha,
  };
}
