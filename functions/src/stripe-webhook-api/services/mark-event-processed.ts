import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { PROCESSED_STRIPE_EVENTS_COLLECTION } from "../../collections/index.js";

/**
 * Mark an event as processed atomically using Firestore create().
 * This prevents race conditions by failing if the document already exists.
 *
 * @param options - Event ID and type
 * @returns Promise resolving to true if successfully marked, false if already exists
 */
export async function wasEventMarkedAsProcessed(options: {
  eventId: string;
  eventType: string;
}): Promise<boolean> {
  const { eventId, eventType } = options;

  const database = getFirestore();
  const documentReference = database
    .collection(PROCESSED_STRIPE_EVENTS_COLLECTION)
    .doc(eventId);

  try {
    await documentReference.create({
      eventId,
      eventType,
      processedAt: Timestamp.now(),
      received: true,
    });
    return true;
  } catch (error: unknown) {
    // Check if this is an already-exists error (duplicate webhook)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 6 // Firestore error code 6 is ALREADY_EXISTS
    ) {
      return false;
    }
    // Re-throw if it's a different error
    throw error;
  }
}
