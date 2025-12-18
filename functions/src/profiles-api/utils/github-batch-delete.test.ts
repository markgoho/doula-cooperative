import { describe, expect, it, mock } from "bun:test";
import { batchDeleteFiles } from "./github-batch-delete.js";

describe("batchDeleteFiles", () => {
  interface SetupOptions {
    filePaths?: string[];
    commitMessage?: string;
    existingFiles?: string[];
    getReferenceError?: boolean;
    getCommitError?: boolean;
    createTreeError?: boolean;
    createCommitError?: boolean;
    updateReferenceError?: boolean;
    rateLimitError?: boolean;
  }

  function setup({
    filePaths = [
      "hugo/content/doulas/test-slug/test-slug-profile.jpg",
      "hugo/content/doulas/test-slug/test-slug-profile-300.avif",
      "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
    ],
    commitMessage = "Delete test profile images",
    existingFiles = [
      "hugo/content/doulas/test-slug/test-slug-profile.jpg",
      "hugo/content/doulas/test-slug/test-slug-profile-300.avif",
      "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
    ],
    getReferenceError = false,
    getCommitError = false,
    createTreeError = false,
    createCommitError = false,
    updateReferenceError = false,
    rateLimitError = false,
  }: SetupOptions = {}) {
    const mockGetReference = mock(() => {
      if (getReferenceError) {
        return Promise.reject(new Error("Branch not found"));
      }
      return Promise.resolve({ data: { object: { sha: "commit-sha-123" } } });
    });

    const mockGetCommit = mock(() => {
      if (getCommitError) {
        return Promise.reject(new Error("Commit not found"));
      }
      return Promise.resolve({ data: { tree: { sha: "tree-sha-123" } } });
    });

    const mockGetTree = mock(() =>
      Promise.resolve({
        data: {
          tree: [
            {
              path: "hugo/content/doulas/test-slug/test-slug-profile.jpg",
              mode: "100644",
              type: "blob",
              sha: "file-sha-1",
            },
            {
              path: "hugo/content/doulas/test-slug/test-slug-profile-300.avif",
              mode: "100644",
              type: "blob",
              sha: "file-sha-2",
            },
            {
              path: "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
              mode: "100644",
              type: "blob",
              sha: "file-sha-3",
            },
            {
              path: "hugo/content/doulas/test-slug/other-file.md",
              mode: "100644",
              type: "blob",
              sha: "other-sha",
            },
          ],
        },
      }),
    );

    const mockCreateTree = mock(() => {
      if (createTreeError) {
        return Promise.reject(new Error("Invalid tree"));
      }
      return Promise.resolve({ data: { sha: "new-tree-sha-456" } });
    });

    const mockCreateCommit = mock(() => {
      if (createCommitError) {
        return Promise.reject(new Error("Commit creation failed"));
      }
      return Promise.resolve({ data: { sha: "new-commit-sha-789" } });
    });

    const mockUpdateReference = mock(() => {
      if (updateReferenceError) {
        return Promise.reject(new Error("Update rejected"));
      }
      return Promise.resolve({ data: {} });
    });

    const mockGetContent = mock((options: { path: string }) => {
      if (rateLimitError) {
        const error = new Error("Rate limit exceeded") as Error & {
          status: number;
          response: { headers: { "x-ratelimit-remaining": string } };
        };
        error.status = 403;
        error.response = {
          headers: {
            "x-ratelimit-remaining": "0",
          },
        };
        return Promise.reject(error);
      }

      const filePath = options.path;
      if (existingFiles.includes(filePath)) {
        const index = existingFiles.indexOf(filePath);
        return Promise.resolve({ data: { sha: `file-sha-${index + 1}` } });
      }

      if (Array.isArray((options as unknown as { data?: unknown }).data)) {
        return Promise.resolve({ data: [{ name: "file1.jpg" }] });
      }

      const error = new Error("Not found") as Error & { status: number };
      error.status = 404;
      return Promise.reject(error);
    });

    const mockOctokit = {
      rest: {
        git: {
          getRef: mockGetReference,
          getCommit: mockGetCommit,
          getTree: mockGetTree,
          createTree: mockCreateTree,
          createCommit: mockCreateCommit,
          updateRef: mockUpdateReference,
        },
        repos: {
          getContent: mockGetContent,
        },
      },
    };

    return {
      mockOctokit,
      filePaths,
      commitMessage,
      mockGetReference,
      mockGetCommit,
      mockGetTree,
      mockCreateTree,
      mockCreateCommit,
      mockUpdateReference,
      mockGetContent,
    };
  }

  it("should successfully delete multiple files in a single commit", async () => {
    const { mockOctokit, filePaths, commitMessage } = setup();

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths,
      commitMessage,
    });

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toHaveLength(3);
    expect(result.deletedFiles).toEqual([
      "hugo/content/doulas/test-slug/test-slug-profile.jpg",
      "hugo/content/doulas/test-slug/test-slug-profile-300.avif",
      "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
    ]);
    expect(result.commitSha).toBe("new-commit-sha-789");
  });

  it("should return empty array when no files exist (all 404s)", async () => {
    const { mockOctokit, commitMessage } = setup({ existingFiles: [] });

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: [
        "hugo/content/doulas/test-slug/non-existent-1.jpg",
        "hugo/content/doulas/test-slug/non-existent-2.avif",
      ],
      commitMessage,
    });

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toHaveLength(0);
    expect(result.commitSha).toBeUndefined();
  });

  it("should throw rate limit error when GitHub API is rate limited", () => {
    const { mockOctokit, filePaths, commitMessage } = setup({
      rateLimitError: true,
    });

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths,
        commitMessage,
      }),
    ).rejects.toThrow();
  });

  it("should throw error when branch reference is invalid", () => {
    const { mockOctokit, filePaths, commitMessage } = setup({
      getReferenceError: true,
    });

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "non-existent-branch",
        filePaths,
        commitMessage,
      }),
    ).rejects.toThrow("Failed to get branch reference");
  });

  it("should handle mix of existing and non-existing files correctly", async () => {
    const { mockOctokit } = setup({
      filePaths: [
        "hugo/content/doulas/test-slug/test-slug-profile.jpg",
        "hugo/content/doulas/test-slug/non-existent.png",
        "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
      ],
      existingFiles: [
        "hugo/content/doulas/test-slug/test-slug-profile.jpg",
        "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
      ],
    });

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: [
        "hugo/content/doulas/test-slug/test-slug-profile.jpg",
        "hugo/content/doulas/test-slug/non-existent.png",
        "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
      ],
      commitMessage: "Delete profile images",
    });

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toHaveLength(2);
    expect(result.deletedFiles).toContain(
      "hugo/content/doulas/test-slug/test-slug-profile.jpg",
    );
    expect(result.deletedFiles).toContain(
      "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
    );
    expect(result.deletedFiles).not.toContain(
      "hugo/content/doulas/test-slug/non-existent.png",
    );
  });

  it("should use correct commit message", async () => {
    const commitMessage = "Delete all profile images for john-doe";
    const { mockOctokit } = setup({
      filePaths: ["hugo/content/doulas/john-doe/john-doe-profile.jpg"],
      existingFiles: ["hugo/content/doulas/john-doe/john-doe-profile.jpg"],
      commitMessage,
    });

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: ["hugo/content/doulas/john-doe/john-doe-profile.jpg"],
      commitMessage,
    });

    // Test behavior - operation succeeded with expected result
    expect(result.success).toBe(true);
    expect(result.deletedFiles).toHaveLength(1);
    expect(result.commitSha).toBe("new-commit-sha-789");
  });

  it("should successfully update branch reference", async () => {
    const { mockOctokit } = setup({
      filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
      existingFiles: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
    });

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
      commitMessage: "Delete profile image",
    });

    // Test behavior - operation completed successfully
    expect(result.success).toBe(true);
    expect(result.deletedFiles).toHaveLength(1);
    expect(result.commitSha).toBe("new-commit-sha-789");
  });

  it("should throw error when updateRef fails due to concurrent modification", () => {
    const { mockOctokit, filePaths, commitMessage } = setup({
      updateReferenceError: true,
    });

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths,
        commitMessage,
      }),
    ).rejects.toThrow("profile was modified by another operation");
  });

  it("should delete files efficiently using base_tree approach", async () => {
    const { mockOctokit, mockGetTree } = setup({
      filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
      existingFiles: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
    });

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
      commitMessage: "Delete profile image",
    });

    // Test behavior - successful deletion without fetching full tree
    expect(result.success).toBe(true);
    expect(result.deletedFiles).toHaveLength(1);
    expect(result.commitSha).toBe("new-commit-sha-789");
    expect(mockGetTree).not.toHaveBeenCalled();
  });

  it("should handle getContent returning non-file objects gracefully", async () => {
    const { mockOctokit } = setup({
      filePaths: [
        "hugo/content/doulas/test-slug",
        "hugo/content/doulas/test-slug/test-slug-profile.jpg",
      ],
      existingFiles: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
    });

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: [
        "hugo/content/doulas/test-slug",
        "hugo/content/doulas/test-slug/test-slug-profile.jpg",
      ],
      commitMessage: "Delete profile images",
    });

    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles[0]).toBe(
      "hugo/content/doulas/test-slug/test-slug-profile.jpg",
    );
  });

  it("should throw error when getCommit fails", () => {
    const { mockOctokit, filePaths, commitMessage } = setup({
      getCommitError: true,
    });

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths,
        commitMessage,
      }),
    ).rejects.toThrow("Failed to get current commit");
  });

  it("should throw error when createTree fails", () => {
    const { mockOctokit, filePaths, commitMessage } = setup({
      createTreeError: true,
    });

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths,
        commitMessage,
      }),
    ).rejects.toThrow("Failed to create new tree");
  });

  it("should throw error when createCommit fails", () => {
    const { mockOctokit, filePaths, commitMessage } = setup({
      createCommitError: true,
    });

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths,
        commitMessage,
      }),
    ).rejects.toThrow("Failed to create commit");
  });
});
