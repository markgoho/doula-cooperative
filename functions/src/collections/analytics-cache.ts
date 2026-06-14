import type { Timestamp } from "firebase-admin/firestore";

/**
 * Analytics cache collection: stores short-lived cached API responses
 */
export const ANALYTICS_CACHE_COLLECTION = "analytics_cache";

export interface AnalyticsCacheDocument {
  payload: unknown;
  cachedAt: Timestamp;
}
