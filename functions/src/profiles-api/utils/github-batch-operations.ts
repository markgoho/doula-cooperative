import * as logger from "firebase-functions/logger";
import { type Octokit } from "octokit";
import { isRateLimitError } from "./github-error.js";

export interface FileOperation {
  path: string;
  operation: "create" | "update" | "delete";
  /** Base64-encoded file content (required for create/update) */
  content?: string;
  /** File SHA (required for update operations to prevent overwrites) */
  sha?: string;
}

export interface BatchOperationsOptions {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
  operations: FileOperation[];
  commitMessage: string;
}

export interface BatchOperationsResult {
  success: boolean;
  commitSha: string;
  createdFiles: string[];
  updatedFiles: string[];
  deletedFiles: string[];
}

/**
 * Validates that all operations have required fields.
 * Throws if validation fails.
 */
function validateOperations(operations: FileOperation[]): void {
  for (const op of operations) {
    if (op.operation === "update" && !op.sha) {
      throw new Error(
        `Update operation for ${op.path} requires SHA to prevent accidental overwrites`,
      );
    }
    if (
      (op.operation === "create" || op.operation === "update") &&
      !op.content
    ) {
      throw new Error(
        `${op.operation} operation for ${op.path} requires content`,
      );
    }
  }
}

/**
 * Batch execute multiple file operations (create, update, delete) in a single atomic commit.
 * Uses Git's low-level Tree API to create an atomic commit with multiple file changes.
 *
 * @param options - Configuration for the batch operations
 * @returns Result containing lists of created, updated, and deleted files with commit SHA
 * @throws Error if GitHub API calls fail (rate limit, invalid branch, validation errors, etc.)
 */
export async function batchOperateFiles(
  options: BatchOperationsOptions,
): Promise<BatchOperationsResult> {
  const { octokit, owner, repo, branch, operations, commitMessage } = options;

  // 1. Validate operations before starting
  validateOperations(operations);

  if (operations.length === 0) {
    logger.info("No operations to perform");
    return {
      success: true,
      commitSha: "",
      createdFiles: [],
      updatedFiles: [],
      deletedFiles: [],
    };
  }

  // 2. Get current branch reference
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

  // 3. Get current commit and tree
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

  // 4. Get the full tree
  let baseTree;
  try {
    const treeResponse = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: baseTreeSha,
      recursive: "true",
    });
    baseTree = treeResponse.data;
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      throw error;
    }
    logger.error("Failed to get tree", {
      owner,
      repo,
      treeSha: baseTreeSha,
      error,
    });
    throw new Error("Failed to get repository tree");
  }

  // 5. Build new tree with all operations
  const pathsToDelete = new Set(
    operations.filter(op => op.operation === "delete").map(op => op.path),
  );

  // Start with existing tree items, excluding files to be deleted
  const newTreeItems = baseTree.tree
    .filter(item => !pathsToDelete.has(item.path || ""))
    .map(item => ({
      path: item.path,
      mode: item.mode,
      type: item.type,
      sha: item.sha,
    }));

  // Track which operations we're performing for result
  const createdFiles: string[] = [];
  const updatedFiles: string[] = [];
  const deletedFiles: string[] = operations
    .filter(op => op.operation === "delete")
    .map(op => op.path);

  // Add/update files for create and update operations
  for (const op of operations) {
    if (op.operation === "create") {
      // Create new blob
      try {
        if (!op.content) {
          throw new Error(
            `Content required for create operation on ${op.path}`,
          );
        }
        const blobResponse = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: op.content,
          encoding: "base64",
        });

        newTreeItems.push({
          path: op.path,
          mode: "100644" as const, // Regular file
          type: "blob" as const,
          sha: blobResponse.data.sha,
        });

        createdFiles.push(op.path);
      } catch (error: unknown) {
        if (isRateLimitError(error)) {
          throw error;
        }
        logger.error("Failed to create blob", {
          owner,
          repo,
          path: op.path,
          error,
        });
        throw new Error(`Failed to create blob for ${op.path}`);
      }
    } else if (op.operation === "update") {
      // Create new blob for updated content
      try {
        if (!op.content) {
          throw new Error(
            `Content required for update operation on ${op.path}`,
          );
        }
        const blobResponse = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: op.content,
          encoding: "base64",
        });

        // Find and update existing tree item
        const existingIndex = newTreeItems.findIndex(
          item => item.path === op.path,
        );

        if (existingIndex === -1) {
          // File doesn't exist in tree - this is actually a create operation
          logger.warn(
            `Update operation for ${op.path} but file not found in tree - treating as create`,
          );
          newTreeItems.push({
            path: op.path,
            mode: "100644" as const,
            type: "blob" as const,
            sha: blobResponse.data.sha,
          });
          createdFiles.push(op.path);
        } else {
          // Verify SHA matches if provided (safety check)
          if (op.sha && newTreeItems[existingIndex]?.sha !== op.sha) {
            throw new Error(
              `SHA mismatch for ${op.path}: expected ${op.sha} but found ${newTreeItems[existingIndex]?.sha}. File may have been modified concurrently.`,
            );
          }

          // Update the blob SHA
          const existingItem = newTreeItems[existingIndex];
          if (existingItem) {
            newTreeItems[existingIndex] = {
              ...existingItem,
              sha: blobResponse.data.sha,
            };
          }
          updatedFiles.push(op.path);
        }
      } catch (error: unknown) {
        if (isRateLimitError(error)) {
          throw error;
        }
        // If it's our SHA mismatch error, rethrow it
        if (error instanceof Error && error.message.includes("SHA mismatch")) {
          throw error;
        }
        logger.error("Failed to create blob for update", {
          owner,
          repo,
          path: op.path,
          error,
        });
        throw new Error(`Failed to update blob for ${op.path}`);
      }
    }
  }

  // 6. Create new tree
  let newTreeSha: string;
  try {
    const newTreeResponse = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: newTreeItems as {
        path?: string;
        mode?: "100644" | "100755" | "040000" | "160000" | "120000";
        type?: "blob" | "tree" | "commit";
        sha?: string | null;
      }[],
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

  logger.info("Successfully executed batch operations", {
    owner,
    repo,
    branch,
    createdFiles,
    updatedFiles,
    deletedFiles,
    commitSha: newCommitSha,
  });

  return {
    success: true,
    commitSha: newCommitSha,
    createdFiles,
    updatedFiles,
    deletedFiles,
  };
}
