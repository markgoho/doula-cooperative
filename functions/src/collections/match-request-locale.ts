/**
 * Supported locales for doula match requests.
 */
export const MATCH_REQUEST_LOCALE = ["en", "es"] as const;

export type MatchRequestLocale = (typeof MATCH_REQUEST_LOCALE)[number];
