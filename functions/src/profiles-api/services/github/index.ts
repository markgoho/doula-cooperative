import { createProfile } from "./create-profile.js";
import type { ProfileGitHubService as ProfileGitHubServiceInterface } from "./interface.js";
import { readProfile } from "./read-profile.js";
import { writeProfile } from "./write-profile.js";

export const ProfileGitHubService: ProfileGitHubServiceInterface = {
  readProfile,
  writeProfile,
  createProfile,
};

export type { ReadProfileResponse, WriteProfileResponse } from "./interface.js";
