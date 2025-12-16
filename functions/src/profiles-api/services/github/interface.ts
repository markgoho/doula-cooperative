import type { ProfileData } from "../../schemas/profile-schemas.js";

/**
 * Response from reading a profile from GitHub.
 * Returns structured profile data (parsed from markdown front matter and body).
 */
export interface ReadProfileResponse extends ProfileData {
  /** Profile image URL (if exists) */
  image?: string;
}

/**
 * Response from writing/creating a profile on GitHub.
 */
export interface WriteProfileResponse {
  success: true;
}

/**
 * Service interface for GitHub profile operations.
 * Handles reading and writing profile markdown files to the repository.
 */
export interface ProfileGitHubService {
  /**
   * Read a profile's content and image from GitHub.
   * Parses markdown front matter and returns structured ProfileData.
   *
   * @param options.slug - The profile slug (directory name)
   * @returns Promise with parsed profile data and optional image URL
   * @throws HttpError if profile not found, YAML parsing fails, or GitHub API fails
   */
  readProfile(options: { slug: string }): Promise<ReadProfileResponse>;

  /**
   * Update an existing profile on GitHub.
   *
   * @param options.slug - The profile slug (directory name)
   * @param options.data - The profile data to write
   * @param options.existingSha - SHA of the existing file (for conflict detection)
   * @returns Promise with success status
   * @throws HttpError if profile not found, conflict, or GitHub API fails
   */
  writeProfile(options: {
    slug: string;
    data: ProfileData;
    existingSha: string;
  }): Promise<WriteProfileResponse>;

  /**
   * Create a new profile on GitHub.
   *
   * @param options.slug - The profile slug (directory name)
   * @param options.data - The profile data to write
   * @returns Promise with success status
   * @throws HttpError if profile already exists or GitHub API fails
   */
  createProfile(options: {
    slug: string;
    data: ProfileData;
  }): Promise<WriteProfileResponse>;
}
