import { getFirestore } from "firebase-admin/firestore";
import {
  REFERRAL_PORTAL_SETTINGS_DOC_ID,
  SETTINGS_COLLECTION,
} from "../../../collections/settings.js";
import type { ReferralPortalSettings } from "./interface.js";
import { toReferralPortalSettings } from "./to-referral-portal-settings.js";

export async function getReferralPortalSettings(): Promise<ReferralPortalSettings> {
  const snapshot = await getFirestore()
    .collection(SETTINGS_COLLECTION)
    .doc(REFERRAL_PORTAL_SETTINGS_DOC_ID)
    .get();

  return toReferralPortalSettings(snapshot.data());
}
