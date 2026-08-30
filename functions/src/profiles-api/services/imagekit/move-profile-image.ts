import { logger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { buildProfileImageUrl } from "../../../constants/imagekit.js";
import { getImageKitClient } from "../../utils/imagekit-client.js";

export interface MoveProfileImageResult {
  moved: boolean;
}

/**
 * Move a profile image from one slug's ImageKit folder to another.
 *
 * Downloads the existing image, uploads it under the new slug's path first,
 * then deletes the old file — in that order, so a failed upload never leaves
 * the member with no photo at all. No-op if no image exists at the old slug.
 * Skips in emulator mode since ImageKit is an external service.
 */
export async function moveProfileImage(options: {
  oldSlug: string;
  newSlug: string;
}): Promise<MoveProfileImageResult> {
  const { oldSlug, newSlug } = options;

  if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.info("Emulator detected, skipping ImageKit profile image move", {
      oldSlug,
      newSlug,
    });
    return { moved: false };
  }

  const imagekit = getImageKitClient();

  try {
    const results = await imagekit.assets.list({
      searchQuery: `name:"${oldSlug}-profile"`,
      path: `/doulas/${oldSlug}`,
      limit: 1,
    });

    const existingFile = results[0];

    if (!existingFile || !("fileId" in existingFile)) {
      logger.info("No ImageKit profile image found, skipping move", {
        oldSlug,
        newSlug,
      });
      return { moved: false };
    }

    const imageResponse = await fetch(buildProfileImageUrl(oldSlug));

    if (!imageResponse.ok) {
      throw new Error(
        `Failed to download existing profile image: ${imageResponse.status}`,
      );
    }

    const contentType =
      imageResponse.headers.get("content-type") ?? "image/jpeg";
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Content = Buffer.from(imageBuffer).toString("base64");
    const dataUri = `data:${contentType};base64,${base64Content}`;

    await imagekit.files.upload({
      file: dataUri,
      fileName: `${newSlug}-profile`,
      folder: `/doulas/${newSlug}`,
      useUniqueFileName: false,
    });

    await imagekit.files.delete(existingFile.fileId);

    logger.info("Moved profile image to new slug in ImageKit", {
      oldSlug,
      newSlug,
    });

    return { moved: true };
  } catch (error) {
    logger.error("Failed to move profile image in ImageKit", {
      errorId: ERROR_IDS.ADMIN_CHANGE_SLUG_IMAGE_MOVE_FAILED,
      oldSlug,
      newSlug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
