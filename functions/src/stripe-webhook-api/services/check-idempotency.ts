import { getFirestore } from "firebase-admin/firestore";
import { PROCESSED_STRIPE_EVENTS_COLLECTION } from "../../collections/index.js";

/**
 * Check if an event has already been processed (idempotency).
 *
 * @param eventId - The Stripe event ID
 * @returns Promise resolving to true if already processed
 */
export async function wasAlreadyProcessed(eventId: string): Promise<boolean> {
  const database = getFirestore();
  const documentReference = database
    .collection(PROCESSED_STRIPE_EVENTS_COLLECTION)
    .doc(eventId);

  const document = await documentReference.get();
  return document.exists;
}
