import type { ProfileGitHubService as ProfileGitHubServiceInterface } from "./interface.js";
import { createProfile } from "./create-profile.js";
import { readProfile } from "./read-profile.js";
import { writeProfile } from "./write-profile.js";

/**
 * GitHub service for profile operations.
 * Handles reading and writing profile markdown files to the repository.
 *
 * Requires GitHub App secrets:
 * - GITHUB_APP_ID
 * - GITHUB_PRIVATE_KEY
 * - GITHUB_INSTALLATION_ID
 */
export const ProfileGitHubService: ProfileGitHubServiceInterface = {
  readProfile,
  writeProfile,
  createProfile,
};

export type { ReadProfileResponse, WriteProfileResponse } from "./interface.js";

// Note: ProfileGitHubService type is exported from ./interface.js directly
// The const ProfileGitHubService above implements that interface
