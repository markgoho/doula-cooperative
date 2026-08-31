import { createProfile } from "./create-profile.js";
import { deleteProfile } from "./delete-profile.js";
import { draftProfile } from "./draft-profile.js";
import type { ProfileStoreService as ProfileStoreServiceInterface } from "./interface.js";
import { readProfile } from "./read-profile.js";
import { stampProfileImageUpdated } from "./stamp-profile-image.js";
import { writeProfile } from "./write-profile.js";

export const ProfileStoreService: ProfileStoreServiceInterface = {
  readProfile,
  writeProfile,
  createProfile,
  draftProfile,
  deleteProfile,
  stampProfileImageUpdated,
};

export type {
  ProfileStoreService as ProfileStoreServiceType,
  ReadProfileResponse,
  WriteProfileResponse,
} from "./interface.js";
