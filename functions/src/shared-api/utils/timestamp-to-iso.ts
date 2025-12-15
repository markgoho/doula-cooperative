import type { Timestamp } from "firebase-admin/firestore";

/**
 * Convert a Firestore Timestamp to ISO 8601 string.
 * Handles production Timestamps, emulator objects, and already-converted strings.
 *
 * @param timestamp - Firestore Timestamp, emulator object, or ISO string
 * @returns ISO 8601 formatted date string
 */
export function timestampToIso(
  timestamp: Timestamp | { _seconds: number; _nanoseconds: number } | string,
): string {
  // Handle string (already ISO format from emulator or other source)
  if (typeof timestamp === "string") {
    return timestamp;
  }

  // Must be an object at this point for 'in' operator to work
  if (typeof timestamp !== "object" || timestamp === null) {
    throw new Error(
      `Invalid timestamp format: expected Timestamp, emulator object, or string, got ${typeof timestamp}`,
    );
  }

  // Check if it's a real Timestamp object with toDate method (production)
  if ("toDate" in timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toISOString();
  }

  // Handle emulator format (plain object with _seconds and _nanoseconds)
  if ("_seconds" in timestamp && "_nanoseconds" in timestamp) {
    const milliseconds =
      timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000;
    return new Date(milliseconds).toISOString();
  }

  // This shouldn't happen with proper TypeScript types, but handle it gracefully
  throw new Error(
    `Invalid timestamp format: expected Timestamp or emulator object, got ${JSON.stringify(timestamp)}`,
  );
}
