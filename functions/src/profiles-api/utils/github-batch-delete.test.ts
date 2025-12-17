import { beforeEach, describe, expect, it, mock } from "bun:test";
import { batchDeleteFiles } from "./github-batch-delete.js";

describe("batchDeleteFiles", () => {
  const mockGetReference = mock();
  const mockGetCommit = mock();
  const mockGetTree = mock();
  const mockCreateTree = mock();
  const mockCreateCommit = mock();
  const mockUpdateReference = mock();
  const mockGetContent = mock();

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

  function setupDefaultMocks() {
    mockGetReference.mockResolvedValue({ data: { object: { sha: "commit-sha-123" } } });
    mockGetCommit.mockResolvedValue({ data: { tree: { sha: "tree-sha-123" } } });
    mockGetTree.mockResolvedValue({
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
    });
    mockCreateTree.mockResolvedValue({ data: { sha: "new-tree-sha-456" } });
    mockCreateCommit.mockResolvedValue({ data: { sha: "new-commit-sha-789" } });
    mockUpdateReference.mockResolvedValue({ data: {} });
  }

  beforeEach(() => {
    // Reset all mocks before each test
    mockGetReference.mockReset();
    mockGetCommit.mockReset();
    mockGetTree.mockReset();
    mockCreateTree.mockReset();
    mockCreateCommit.mockReset();
    mockUpdateReference.mockReset();
    mockGetContent.mockReset();

    // Set up default mock implementations
    setupDefaultMocks();
  });

  it("should successfully delete multiple files in a single commit", async () => {
    mockGetContent
      .mockResolvedValueOnce({ data: { sha: "file-sha-1" } })
      .mockResolvedValueOnce({ data: { sha: "file-sha-2" } })
      .mockResolvedValueOnce({ data: { sha: "file-sha-3" } });

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: [
        "hugo/content/doulas/test-slug/test-slug-profile.jpg",
        "hugo/content/doulas/test-slug/test-slug-profile-300.avif",
        "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
      ],
      commitMessage: "Delete test profile images",
    });

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toHaveLength(3);
    expect(result.commitSha).toBe("new-commit-sha-789");

    // Verify API calls were made in correct order (no getTree call in current implementation)
    expect(mockGetReference).toHaveBeenCalledTimes(1);
    expect(mockGetContent).toHaveBeenCalledTimes(3);
    expect(mockGetCommit).toHaveBeenCalledTimes(1);
    expect(mockCreateTree).toHaveBeenCalledTimes(1);
    expect(mockCreateCommit).toHaveBeenCalledTimes(1);
    expect(mockUpdateReference).toHaveBeenCalledTimes(1);

    // Verify createTree was called with base_tree and deletion markers
    const createTreeCall = mockCreateTree.mock.calls[0]?.[0] as {
      base_tree: string;
      tree: { path: string; mode: string; type: string; sha: null }[];
    };
    expect(createTreeCall.base_tree).toBe("tree-sha-123");
    expect(createTreeCall.tree).toHaveLength(3);
    // Verify all items are marked for deletion (sha is null per GitHub API)
    // eslint-disable-next-line unicorn/no-null -- GitHub API uses null for deletion
    expect(createTreeCall.tree[0]?.sha).toBe(null);
    // eslint-disable-next-line unicorn/no-null -- GitHub API uses null for deletion
    expect(createTreeCall.tree[1]?.sha).toBe(null);
    // eslint-disable-next-line unicorn/no-null -- GitHub API uses null for deletion
    expect(createTreeCall.tree[2]?.sha).toBe(null);
  });

  it("should return empty array when no files exist (all 404s)", async () => {
    mockGetContent.mockRejectedValue({ status: 404 });

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: [
        "hugo/content/doulas/test-slug/non-existent-1.jpg",
        "hugo/content/doulas/test-slug/non-existent-2.avif",
      ],
      commitMessage: "Delete non-existent files",
    });

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toHaveLength(0);
    expect(result.commitSha).toBeUndefined();

    // Should only check files, not create any commits
    expect(mockGetContent).toHaveBeenCalledTimes(2);
    expect(mockCreateCommit).not.toHaveBeenCalled();
    expect(mockUpdateReference).not.toHaveBeenCalled();
  });

  it("should throw rate limit error when GitHub API is rate limited", () => {
    mockGetContent.mockRejectedValue({
      status: 403,
      response: {
        headers: {
          "x-ratelimit-remaining": "0",
        },
      },
    });

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
        commitMessage: "Delete profile image",
      }),
    ).rejects.toThrow();

    // Should not attempt to create commit
    expect(mockCreateCommit).not.toHaveBeenCalled();
  });

  it("should throw error when branch reference is invalid", () => {
    mockGetReference.mockRejectedValue(new Error("Branch not found"));

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "non-existent-branch",
        filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
        commitMessage: "Delete profile image",
      }),
    ).rejects.toThrow("Failed to get branch reference");
  });

  it("should handle mix of existing and non-existing files correctly", async () => {
    mockGetContent
      .mockResolvedValueOnce({ data: { sha: "file-sha-1" } })
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ data: { sha: "file-sha-3" } });

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
    expect(result.deletedFiles).toContain("hugo/content/doulas/test-slug/test-slug-profile.jpg");
    expect(result.deletedFiles).toContain(
      "hugo/content/doulas/test-slug/test-slug-profile-600.avif",
    );
    expect(result.deletedFiles).not.toContain(
      "hugo/content/doulas/test-slug/non-existent.png",
    );
  });

  it("should use correct commit message", async () => {
    mockGetContent.mockResolvedValue({ data: { sha: "file-sha-1" } });

    const commitMessage = "Delete all profile images for john-doe";
    await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: ["hugo/content/doulas/john-doe/john-doe-profile.jpg"],
      commitMessage,
    });

    const createCommitCall = mockCreateCommit.mock.calls[0]?.[0] as { message: string };
    expect(createCommitCall.message).toBe(commitMessage);
  });

  it("should update branch reference with force=false", async () => {
    mockGetContent.mockResolvedValue({ data: { sha: "file-sha-1" } });

    await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
      commitMessage: "Delete profile image",
    });

    const updateReferenceCall = mockUpdateReference.mock.calls[0]?.[0] as { force: boolean };
    expect(updateReferenceCall.force).toBe(false);
  });

  it("should throw error when updateRef fails due to concurrent modification", () => {
    mockGetContent.mockResolvedValue({ data: { sha: "file-sha-1" } });
    mockUpdateReference.mockRejectedValue(new Error("Update rejected"));

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
        commitMessage: "Delete profile image",
      }),
    ).rejects.toThrow("profile was modified by another operation");
  });

  it("should use base_tree approach to delete files efficiently", async () => {
    mockGetContent.mockResolvedValue({ data: { sha: "file-sha-1" } });

    await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
      commitMessage: "Delete profile image",
    });

    // Verify createTree uses base_tree parameter (efficient approach)
    const createTreeCall = mockCreateTree.mock.calls[0]?.[0] as {
      base_tree: string;
    };
    expect(createTreeCall.base_tree).toBe("tree-sha-123");

    // Verify getTree is NOT called (we use base_tree instead)
    expect(mockGetTree).not.toHaveBeenCalled();
  });

  it("should handle getContent returning non-file objects gracefully", async () => {
    // Simulate getContent returning a directory
    mockGetContent
      .mockResolvedValueOnce({ data: [{ name: "file1.jpg" }] })
      .mockResolvedValueOnce({ data: { sha: "file-sha-2" } });

    const result = await batchDeleteFiles({
      octokit: mockOctokit as never,
      owner: "test-owner",
      repo: "test-repo",
      branch: "main",
      filePaths: [
        "hugo/content/doulas/test-slug", // directory
        "hugo/content/doulas/test-slug/test-slug-profile.jpg", // file
      ],
      commitMessage: "Delete profile images",
    });

    // Should only delete the actual file, not the directory
    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles[0]).toBe("hugo/content/doulas/test-slug/test-slug-profile.jpg");
  });

  it("should throw error when getCommit fails", () => {
    mockGetContent.mockResolvedValue({ data: { sha: "file-sha-1" } });
    mockGetCommit.mockRejectedValue(new Error("Commit not found"));

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
        commitMessage: "Delete profile image",
      }),
    ).rejects.toThrow("Failed to get current commit");
  });

  it("should throw error when createTree fails", () => {
    mockGetContent.mockResolvedValue({ data: { sha: "file-sha-1" } });
    mockCreateTree.mockRejectedValue(new Error("Invalid tree"));

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
        commitMessage: "Delete profile image",
      }),
    ).rejects.toThrow("Failed to create new tree");
  });

  it("should throw error when createCommit fails", () => {
    mockGetContent.mockResolvedValue({ data: { sha: "file-sha-1" } });
    mockCreateCommit.mockRejectedValue(new Error("Commit creation failed"));

    expect(
      batchDeleteFiles({
        octokit: mockOctokit as never,
        owner: "test-owner",
        repo: "test-repo",
        branch: "main",
        filePaths: ["hugo/content/doulas/test-slug/test-slug-profile.jpg"],
        commitMessage: "Delete profile image",
      }),
    ).rejects.toThrow("Failed to create commit");
  });
});
