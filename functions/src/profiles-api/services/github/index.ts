import { createProfile } from "./create-profile.js";
import type { ProfileGitHubService as ProfileGitHubServiceInterface } from "./interface.js";
import { readProfile } from "./read-profile.js";
import {
  removeFrontMatterImagePath,
  updateFrontMatterImagePath,
} from "./update-front-matter.js";
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
  updateFrontMatterImagePath,
  removeFrontMatterImagePath,
};

export type { ReadProfileResponse, WriteProfileResponse } from "./interface.js";
