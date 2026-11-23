import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../collections/index.js";

/**
 * One-time data fix: older Match Requests store `submitted` as a string.
 * `MatchRequestDocument` types it as a Timestamp, so convert the stored value.
 *
 * Dry run by default; pass --apply to write.
 *   bun run convert-match-request-submitted                         # emulator, dry run
 *   USE_EMULATOR=false bun run convert-match-request-submitted          # production, dry run
 *   USE_EMULATOR=false bun run convert-match-request-submitted --apply  # production, write
 */

const SHOULD_USE_EMULATOR = process.env["USE_EMULATOR"] !== "false";
const SHOULD_APPLY = process.argv.includes("--apply");
const BATCH_LIMIT = 400;

/** The Timestamp a stored `submitted` value stands for, or undefined if unreadable. */
function toTimestamp(value: unknown): Timestamp | undefined {
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : Timestamp.fromDate(date);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "_seconds" in value &&
    typeof value._seconds === "number"
  ) {
    return new Timestamp(value._seconds, 0);
  }
  return undefined;
}

async function convertMatchRequestSubmitted() {
  if (SHOULD_USE_EMULATOR) {
    process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8090";
    process.env["GCLOUD_PROJECT"] = "doula-cooperative";
    console.log("🔧 Using Firestore emulator at localhost:8090");
  } else {
    console.log("⚠️  Using PRODUCTION Firestore");
  }
  console.log(
    SHOULD_APPLY
      ? "✍️  Applying changes"
      : "👀 Dry run (pass --apply to write)",
  );

  if (getApps().length === 0) initializeApp({ projectId: "doula-cooperative" });
  const firestore = getFirestore();

  const snapshot = await firestore.collection(MATCH_REQUESTS_COLLECTION).get();
  const conversions: { id: string; from: unknown; to: Timestamp }[] = [];
  const unreadable: { id: string; value: unknown }[] = [];

  for (const document of snapshot.docs) {
    const value: unknown = document.get("submitted");
    if (value instanceof Timestamp) continue;
    const converted = toTimestamp(value);
    if (converted) {
      conversions.push({ id: document.id, from: value, to: converted });
    } else {
      unreadable.push({ id: document.id, value });
    }
  }

  console.log(
    `📊 ${snapshot.size} Match Requests: ${conversions.length} to convert, ${unreadable.length} unreadable`,
  );
  for (const { id, from, to } of conversions) {
    console.log(
      `  ${id}: ${JSON.stringify(from)} → ${to.toDate().toISOString()}`,
    );
  }
  for (const { id, value } of unreadable) {
    console.warn(
      `  ❗ ${id}: unreadable submitted ${JSON.stringify(value)} (left unchanged)`,
    );
  }

  if (!SHOULD_APPLY || conversions.length === 0) return;

  for (let start = 0; start < conversions.length; start += BATCH_LIMIT) {
    const batch = firestore.batch();
    const chunk = conversions.slice(start, start + BATCH_LIMIT);
    for (const { id, to } of chunk) {
      batch.update(firestore.collection(MATCH_REQUESTS_COLLECTION).doc(id), {
        submitted: to,
      });
    }
    await batch.commit();
  }
  console.log(`✅ Converted ${conversions.length} Match Requests`);
}

await convertMatchRequestSubmitted();
