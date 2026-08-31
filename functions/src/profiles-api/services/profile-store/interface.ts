import type { ProfileData } from "../../schemas/profile-schemas.js";

export interface ReadProfileResponse extends ProfileData {
  image?: string;
  ownerUid?: string;
}

export interface WriteProfileResponse {
  success: true;
}

export interface ProfileStoreService {
  readProfile(options: { slug: string }): Promise<ReadProfileResponse>;

  writeProfile(options: {
    slug: string;
    data: ProfileData;
  }): Promise<WriteProfileResponse>;

  createProfile(options: {
    slug: string;
    data: ProfileData;
    ownerUid?: string;
  }): Promise<WriteProfileResponse>;

  draftProfile(options: { slug: string }): Promise<WriteProfileResponse>;

  deleteProfile(options: { slug: string }): Promise<WriteProfileResponse>;

  stampProfileImageUpdated(options: {
    slug: string;
  }): Promise<WriteProfileResponse>;
}
