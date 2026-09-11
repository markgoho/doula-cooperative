export const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/doulacoop';

/**
 * Build an ImageKit display URL with transformations and default image fallback.
 *
 * The URL pattern must stay in sync with the Hugo site templates in
 * `layouts/doulas/` so that missing images fall back to the same default
 * placeholder on both the public site and the members app.
 */
export function buildImageKitDisplayUrl(slug: string, width: number, height: number): string {
  return `${IMAGEKIT_BASE_URL}/tr:w-${width},h-${height},fo-face,z-0.5,di-default-profile.png/doulas/${slug}/${slug}-profile`;
}
