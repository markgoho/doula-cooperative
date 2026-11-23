import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  REFERRAL_PORTAL_SETTINGS_DOC_ID,
  SETTINGS_COLLECTION,
} from "../../../collections/settings.js";
import type { ReferralPortalSettings } from "./interface.js";
import { toReferralPortalSettings } from "./to-referral-portal-settings.js";

export async function updateReferralPortalSettings({
  v2Enabled,
  updatedBy,
}: {
  v2Enabled: boolean;
  updatedBy: string;
}): Promise<ReferralPortalSettings> {
  const reference = getFirestore()
    .collection(SETTINGS_COLLECTION)
    .doc(REFERRAL_PORTAL_SETTINGS_DOC_ID);

  await reference.set(
    { v2Enabled, updatedBy, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  // Re-read so the response carries the resolved server timestamp
  const snapshot = await reference.get();
  return toReferralPortalSettings(snapshot.data());
}
