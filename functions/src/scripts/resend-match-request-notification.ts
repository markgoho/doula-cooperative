import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "../collections/match-requests.js";
import { buildDoulaMatchNotification } from "../forms-api/services/build-doula-match-notification.js";
import { sendEmail } from "../shared-api/services/email/index.js";

/**
 * Re-send the Match Request Notification (full request, to the admin and
 * referral inboxes) for Match Requests that got the trimmed email.
 *
 * Pick Match Requests by id, or every one submitted on or after a date.
 * Dry run by default (lists id, submitted time and ZIP only); pass --apply to send.
 *   USE_EMULATOR=false bun run resend-match-request-notification <id> [<id>...]
 *   USE_EMULATOR=false bun run resend-match-request-notification --since=2026-11-22
 *   USE_EMULATOR=false MAILGUN_API_KEY=... bun run resend-match-request-notification <id> --apply
 */

const SHOULD_USE_EMULATOR = process.env["USE_EMULATOR"] !== "false";
const SHOULD_APPLY = process.argv.includes("--apply");
const SINCE = process.argv
  .find(argument => argument.startsWith("--since="))
  ?.slice("--since=".length);
const IDS = process.argv
  .slice(2)
  .filter(argument => !argument.startsWith("--"));

async function loadMatchRequests(): Promise<
  { id: string; document: MatchRequestDocument }[]
> {
  const collection = getFirestore().collection(MATCH_REQUESTS_COLLECTION);
  if (SINCE !== undefined) {
    const since = new Date(SINCE);
    if (Number.isNaN(since.getTime())) {
      throw new TypeError(`Invalid --since date: ${SINCE}`);
    }
    const snapshot = await collection
      .where("submitted", ">=", Timestamp.fromDate(since))
      .orderBy("submitted", "asc")
      .get();
    return snapshot.docs.map(document => ({
      id: document.id,
      document: document.data() as MatchRequestDocument,
    }));
  }
  const documents = await Promise.all(IDS.map(id => collection.doc(id).get()));
  return documents.map(document => {
    if (!document.exists) throw new Error(`No Match Request ${document.id}`);
    return {
      id: document.id,
      document: document.data() as MatchRequestDocument,
    };
  });
}

async function resendMatchRequestNotification() {
  if (SINCE === undefined && IDS.length === 0) {
    throw new Error("Pass Match Request ids or --since=YYYY-MM-DD");
  }
  if (SHOULD_USE_EMULATOR) {
    process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8090";
    process.env["GCLOUD_PROJECT"] = "doula-cooperative";
    console.log("🔧 Using Firestore emulator at localhost:8090");
  } else {
    console.log("⚠️  Using PRODUCTION Firestore");
  }
  console.log(
    SHOULD_APPLY ? "📧 Sending emails" : "👀 Dry run (pass --apply to send)",
  );

  if (getApps().length === 0) initializeApp({ projectId: "doula-cooperative" });
  const matchRequests = await loadMatchRequests();
  console.log(`📊 ${matchRequests.length} Match Request(s)`);

  for (const { id, document } of matchRequests) {
    console.log(
      `  ${id}: submitted ${document.submitted.toDate().toISOString()}, ZIP ${document.zipcode}`,
    );
    if (!SHOULD_APPLY) continue;
    const message = buildDoulaMatchNotification({ data: document });
    await sendEmail({ message }, logger);
    console.log("    ✅ sent");
  }
}

await resendMatchRequestNotification();
