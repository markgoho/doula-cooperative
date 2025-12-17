import { Timestamp } from "firebase-admin/firestore";

/**
 * Calculates the membership expiration date based on subscription start date.
 *
 * Logic:
 * - Takes the month from subscriptionStart (e.g., January = 0, December = 11)
 * - If the current date is past that month, or we're in that month but past day 1,
 *   the expiration is set to that month NEXT year
 * - Otherwise, expiration is that month THIS year
 * - Day is always set to the last day of the expiration month
 *
 * Example: If subscription starts Jan 15, 2025:
 * - Month index is 0 (January)
 * - Today is Jan 15 (currentMonth = 0, day = 15)
 * - Since we're in January and day > 1, expiration is January 2026
 * - Specifically: January 31, 2026 at 23:59:59
 *
 * @param subscriptionStart - The Firestore Timestamp when subscription started
 * @returns Firestore Timestamp for membership expiration (last moment of expiration month)
 */
export function calculateExpirationDate(
  subscriptionStart: Timestamp,
): Timestamp {
  const startDate = subscriptionStart.toDate();
  const monthIndex = startDate.getMonth(); // 0-11 (0=January, 11=December)

  const now = new Date();
  const currentMonth = now.getMonth();

  // Determine if expiration is this year or next year
  // If we're past the renewal month, or in the renewal month but past day 1, renew next year
  const isNextYear =
    currentMonth > monthIndex ||
    (currentMonth === monthIndex && now.getDate() > 1);

  const expirationYear = now.getFullYear() + (isNextYear ? 1 : 0);

  // Set to last day of the expiration month at 23:59:59
  const expirationDate = new Date(
    expirationYear,
    monthIndex + 1,
    0,
    23,
    59,
    59,
  );

  return Timestamp.fromDate(expirationDate);
}
