const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/doulacoop';

/**
 * Build an ImageKit display URL with transformations and default image fallback.
 * Matches the Hugo site's URL pattern so missing images show a default placeholder.
 */
export function buildImageKitDisplayUrl(slug: string, width: number, height: number): string {
  return `${IMAGEKIT_BASE_URL}/tr:w-${width},h-${height},fo-face,z-0.5,di-default-profile.png/doulas/${slug}/${slug}-profile`;
}
