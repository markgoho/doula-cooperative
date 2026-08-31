/** Image formats the profile image API accepts. */
export const ALLOWED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Largest profile image the API accepts, matching MAX_IMAGE_SIZE on the server. */
export const MAX_PROFILE_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
