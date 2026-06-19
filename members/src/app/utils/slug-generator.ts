/**
 * Generate a URL-friendly slug from a name
 * @param name - The name to convert to a slug
 * @returns A lowercase, hyphenated slug
 */
export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      // Handle special characters that don't decompose with NFD
      .replaceAll('ø', 'o')
      .replaceAll('æ', 'ae')
      .replaceAll('œ', 'oe')
      .replaceAll('ß', 'ss')
      .replaceAll('ð', 'd')
      .replaceAll('þ', 'th')
      // Decompose most accented characters into base + combining marks (é → e + ´)
      // Special cases handled above don't decompose with NFD
      .normalize('NFD')
      .replaceAll(/[\u{0300}-\u{036F}]/gu, '') // Remove diacritical marks
      .replaceAll(/[^a-z0-9\s-]/g, '') // Remove remaining special chars
      .replaceAll(/\s+/g, '-') // Replace spaces with hyphens
      .replaceAll(/-+/g, '-') // Remove consecutive hyphens
      .replaceAll(/^-|-$/g, '') // Trim leading/trailing hyphens
  );
}

/**
 * Ensure a slug is unique by appending a numeric suffix if needed
 * @param baseSlug - The base slug to check
 * @param checkSlugExists - Async function that returns true if slug is already taken, false if available
 * @param maxAttempts - Maximum number of attempts to find a unique slug (default: 100)
 * @returns A unique slug (either the original or with a numeric suffix)
 * @throws Error if unable to find unique slug after maxAttempts
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  checkSlugExists: (slug: string) => Promise<boolean>,
  maxAttempts = 100,
): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;

  while (await checkSlugExists(slug)) {
    if (suffix >= maxAttempts) {
      throw new Error(`Unable to find unique slug after ${maxAttempts} attempts`);
    }
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}
