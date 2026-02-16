import type { UploadResponse } from "imagekit/dist/libs/interfaces/UploadResponse.js";
import { App } from "octokit";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../constants/github-config.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import { MemberFirestoreService } from "../../shared-api/services/member-firestore/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileGitHubService } from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import { getImageKitClient } from "../utils/imagekit-client.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Upload profile image for authenticated user.
 * Uploads to ImageKit, updates Firestore and GitHub front matter.
 * POST /api/profiles/:slug/image
 */
export async function uploadImageLogic({
  uid,
  imageData,
  profileMemberService,
  profileGitHubService,
  logger,
  set,
}: {
  uid: string;
  imageData: string;
  profileMemberService: ProfileMemberService;
  profileGitHubService: ProfileGitHubService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<{ success: true; url: string } | { error: string }> {
  logger.info("Profile image upload initiated", { uid });

  try {
    // Verify user has active membership and get slug
    const member = await profileMemberService.verifyActiveMembership(uid);
    const slug = member.slug;

    if (!slug) {
      set.status = 428;
      return {
        error: "Profile slug is required. Please set up your profile first.",
      };
    }

    // Decode base64 image and validate size
    const base64Content = imageData.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Content, "base64");

    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      logger.warn("Image too large", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_TOO_LARGE,
        uid,
        size: imageBuffer.length,
      });
      set.status = 413;
      return {
        error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
      };
    }

    // Upload to ImageKit
    let uploadResult: UploadResponse;
    try {
      const imagekit = getImageKitClient();
      uploadResult = await imagekit.upload({
        file: imageData, // Full data URL
        fileName: `${slug}-profile`,
        folder: `/doulas/${slug}`,
        useUniqueFileName: false, // Overwrite existing
      });

      logger.info("Image uploaded to ImageKit successfully", {
        uid,
        slug,
        fileId: uploadResult.fileId,
        filePath: uploadResult.filePath,
      });
    } catch (error: unknown) {
      logger.error("Failed to upload image to ImageKit", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 500;
      return {
        error: "Failed to upload image. Please try again.",
      };
    }

    // Update Firestore with ImageKit metadata
    try {
      await MemberFirestoreService.updateMember(uid, {
        imagekitPath: uploadResult.filePath,
        imagekitFileId: uploadResult.fileId,
      });

      logger.info("Updated Firestore with ImageKit metadata", {
        uid,
        slug,
        imagekitPath: uploadResult.filePath,
        imagekitFileId: uploadResult.fileId,
      });
    } catch (error: unknown) {
      logger.error("Failed to update Firestore with ImageKit metadata", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 500;
      return {
        error: "Failed to save image metadata. Please try again.",
      };
    }

    // Update GitHub front matter with imagekit_path
    try {
      // Read existing profile (unused, just to validate it exists)
      await profileGitHubService.readProfile({
        slug,
        profileMemberService,
      });

      // Verify GitHub secrets are configured
      const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
      const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
      const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

      if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
        logger.error("Missing GitHub secrets for profile image upload", {
          errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_GITHUB_FAILED,
          hasAppId: Boolean(GITHUB_APP_ID),
          hasPrivateKey: Boolean(GITHUB_PRIVATE_KEY),
          hasInstallationId: Boolean(GITHUB_INSTALLATION_ID),
        });
        throw new HttpError("Missing GitHub configuration", 500);
      }

      // Get file SHA for update
      const app = new App({
        appId: GITHUB_APP_ID,
        privateKey: GITHUB_PRIVATE_KEY,
      });
      const octokit = await app.getInstallationOctokit(
        Number.parseInt(GITHUB_INSTALLATION_ID),
      );

      const filePath = `hugo/content/doulas/${slug}/index.md`;
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
      });

      if (!("sha" in fileData)) {
        throw new Error("Path did not resolve to a file.");
      }

      if (!("content" in fileData)) {
        throw new Error("File content not available.");
      }

      // Get existing content and parse metadata
      const existingContent = Buffer.from(fileData.content, "base64").toString(
        "utf8",
      );

      // Parse existing front matter to preserve all fields
      const frontMatterMatch = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(
        existingContent,
      );
      if (!frontMatterMatch?.[1] || !frontMatterMatch[2]) {
        throw new Error("Could not parse existing front matter");
      }

      const [, existingFrontMatter, bodyContent] = frontMatterMatch;

      // Add or update imagekit_path in front matter
      const imagekitPathLine = `imagekit_path: "${uploadResult.filePath}"`;
      const newFrontMatter = /^imagekit_path:/m.test(existingFrontMatter)
        ? existingFrontMatter.replace(/^imagekit_path:.*$/m, imagekitPathLine)
        : `${existingFrontMatter.trim()}\n${imagekitPathLine}`;

      const newContent = `---\n${newFrontMatter}\n---\n${bodyContent}`;

      // Write updated profile to GitHub
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        message: `Update profile image for ${slug}`,
        content: Buffer.from(newContent, "utf8").toString("base64"),
        sha: fileData.sha,
        branch: GITHUB_BRANCH,
      });

      logger.info("Updated GitHub front matter with imagekit_path", {
        uid,
        slug,
        imagekitPath: uploadResult.filePath,
      });
    } catch (error: unknown) {
      logger.error("Failed to update GitHub front matter", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the request - Firestore is updated, Hugo can fall back
      logger.warn(
        "Image uploaded to ImageKit and Firestore updated, but GitHub front matter update failed",
        { uid, slug },
      );
    }

    return { success: true, url: uploadResult.url };
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "upload profile image",
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_FAILED,
      logger,
      set,
      context: { uid },
    });
  }
}
