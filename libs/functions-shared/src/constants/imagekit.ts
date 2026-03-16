export const IMAGEKIT_SECRETS = ["IMAGEKIT_PRIVATE_KEY"];

/**
 * ImageKit URL endpoint for the Doula Cooperative account.
 * Used to construct deterministic image URLs from slugs.
 */
export const IMAGEKIT_BASE_URL = "https://ik.imagekit.io/doulacoop";

/**
 * Build the canonical ImageKit profile image URL for a given slug.
 * This URL is deterministic — the same slug always produces the same path.
 */
export function buildProfileImageUrl(slug: string): string {
  return `${IMAGEKIT_BASE_URL}/doulas/${slug}/${slug}-profile`;
}
