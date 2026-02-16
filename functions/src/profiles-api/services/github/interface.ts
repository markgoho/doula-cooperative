import type { ProfileData } from "../../schemas/profile-schemas.js";

export interface ReadProfileResponse extends ProfileData {
  image?: string;
}

export interface WriteProfileResponse {
  success: true;
}

export interface ProfileGitHubService {
  readProfile(options: { slug: string }): Promise<ReadProfileResponse>;

  writeProfile(options: {
    slug: string;
    data: ProfileData;
    existingSha: string;
  }): Promise<WriteProfileResponse>;

  createProfile(options: {
    slug: string;
    data: ProfileData;
  }): Promise<WriteProfileResponse>;
}
