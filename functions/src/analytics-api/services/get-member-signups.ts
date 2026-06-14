import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../collections/members.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { isStripeMember } from "../../types/member-document.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { DayCount, MemberSignupsResponse } from "../schemas/analytics-schemas.js";

/**
 * Returns signup counts per day for the current calendar month (NY time).
 * Only counts Stripe members (have stripeCustomerId/stripeSubscriptionId).
 */
export async function getMemberSignups({
  logger,
}: {
  logger: Logger;
}): Promise<MemberSignupsResponse> {
  try {
    const firestore = getFirestore();

    // Compute start/end of current month in NY time using Intl
    const now = new Date();
    const nyFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const nyParts = nyFormatter.formatToParts(now);
    const nyYear = Number(nyParts.find(p => p.type === "year")?.value ?? "0");
    const nyMonth = Number(nyParts.find(p => p.type === "month")?.value ?? "1");

    // First moment of month in NY time -> UTC timestamp
    const monthStart = new Date(
      `${nyYear}-${String(nyMonth).padStart(2, "0")}-01T00:00:00-05:00`,
    );
    // First moment of next month in NY time
    const nextMonth = nyMonth === 12 ? 1 : nyMonth + 1;
    const nextYear = nyMonth === 12 ? nyYear + 1 : nyYear;
    const monthEnd = new Date(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-05:00`,
    );

    const snapshot = await firestore
      .collection(MEMBERS_COLLECTION)
      .where("subscriptionStart", ">=", monthStart)
      .where("subscriptionStart", "<", monthEnd)
      .get();

    // Bucket by NY-time date string
    const counts = new Map<string, number>();
    for (const document_ of snapshot.docs) {
      const data = document_.data() as import("../../types/member-document.js").MemberDocument;
      if (!isStripeMember(data)) continue;
      const jsDate = data.subscriptionStart.toDate();
      const dayString = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(jsDate);
      counts.set(dayString, (counts.get(dayString) ?? 0) + 1);
    }

    // Fill all days in the month up to today
    const nyToday = nyFormatter.format(now);
    const days: DayCount[] = [];
    let cursor = new Date(monthStart);
    while (cursor < monthEnd) {
      const dateString = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(cursor);
      if (dateString > nyToday) break;
      days.push({ date: dateString, count: counts.get(dateString) ?? 0 });
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }

    return { days };
  } catch (error) {
    logger.error("Failed to fetch member signups", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
    });
    throw error;
  }
}
