import { logger } from "firebase-functions/v2";
import { getImageKitClient } from "../../utils/imagekit-client.js";

/**
 * Delete a profile image from ImageKit for a given slug.
 *
 * Searches for the profile image at `/doulas/{slug}/{slug}-profile` and
 * deletes it if found. Handles "not found" gracefully (no image = no-op).
 * Skips in emulator mode since ImageKit is an external service.
 */
export async function deleteProfileImage(options: {
  slug: string;
}): Promise<{ deleted: boolean }> {
  const { slug } = options;

  if (process.env["FUNCTIONS_EMULATOR"]) {
    logger.info("Emulator detected, skipping ImageKit profile image delete", {
      slug,
    });
    return { deleted: false };
  }

  const imagekit = getImageKitClient();

  const results = await imagekit.assets.list({
    searchQuery: `name="${slug}-profile"`,
    path: `/doulas/${slug}`,
    limit: 1,
  });

  const firstResult = results[0];
  if (firstResult && "fileId" in firstResult) {
    await imagekit.files.delete(firstResult.fileId);
    logger.info("Successfully deleted profile image from ImageKit", {
      slug,
      fileId: firstResult.fileId,
    });
    return { deleted: true };
  }

  logger.info("No ImageKit profile image found, skipping delete", {
    slug,
    expectedPath: `/doulas/${slug}/${slug}-profile`,
  });
  return { deleted: false };
}
