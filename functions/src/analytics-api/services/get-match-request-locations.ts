import { getFirestore } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../../collections/match-requests.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  LocationEntry,
  MatchRequestLocationsResponse,
} from "../schemas/analytics-schemas.js";

/**
 * Aggregates all-time match requests by zipcode and resolves lat/lng offline.
 */
export async function getMatchRequestLocations({
  logger,
}: {
  logger: Logger;
}): Promise<MatchRequestLocationsResponse> {
  try {
    // Dynamic import to avoid startup cost when unused
    const zipcodes = await import("zipcodes");

    const firestore = getFirestore();
    const snapshot = await firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .get();

    const counts = new Map<string, number>();
    for (const document_ of snapshot.docs) {
      const data = document_.data() as { zipcode?: string };
      const zip = data.zipcode ?? "";
      if (!zip) continue;
      counts.set(zip, (counts.get(zip) ?? 0) + 1);
    }

    const locations: LocationEntry[] = [];
    let unmapped = 0;

    for (const [zip, count] of counts) {
      const info = zipcodes.lookup(zip);
      if (!info) {
        unmapped += count;
        continue;
      }
      locations.push({
        zip,
        city: info.city,
        state: info.state,
        lat: info.latitude,
        lng: info.longitude,
        count,
      });
    }

    return { locations, unmapped };
  } catch (error) {
    logger.error("Failed to fetch match request locations", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
    });
    throw error;
  }
}
