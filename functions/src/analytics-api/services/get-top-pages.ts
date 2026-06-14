import { Timestamp, getFirestore } from "firebase-admin/firestore";
import {
  ANALYTICS_CACHE_COLLECTION,
  type AnalyticsCacheDocument,
} from "../../collections/analytics-cache.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { TopPagesResponse } from "../schemas/analytics-schemas.js";
import { createPirschClient } from "./pirsch-client.js";

const CACHE_KEY = "topPages:30d";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
const PIRSCH_DAYS = 30;

/**
 * Returns top 5 pages by views over last 30 days.
 * Uses Firestore cache with 3-hour TTL.
 */
export async function getTopPages({
  logger,
}: {
  logger: Logger;
}): Promise<TopPagesResponse> {
  try {
    const firestore = getFirestore();
    const cacheReference = firestore
      .collection(ANALYTICS_CACHE_COLLECTION)
      .doc(CACHE_KEY);

    const cacheDocument = await cacheReference.get();

    if (cacheDocument.exists) {
      const cached = cacheDocument.data() as AnalyticsCacheDocument;
      const age = Date.now() - cached.cachedAt.toDate().getTime();
      if (age < CACHE_TTL_MS) {
        logger.info("Serving top pages from cache", { ageMs: age });
        return cached.payload as TopPagesResponse;
      }
    }

    const client = createPirschClient();
    const pages = await client.getTopPages(PIRSCH_DAYS);
    const payload: TopPagesResponse = { pages };

    await cacheReference.set({
      payload,
      cachedAt: Timestamp.now(),
    });

    logger.info("Fetched top pages from Pirsch and cached", {
      pageCount: pages.length,
    });

    return payload;
  } catch (error) {
    logger.error("Failed to fetch top pages", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
    });
    throw error;
  }
}
