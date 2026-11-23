import type { DecodedIdToken } from "firebase-admin/auth";
import { canRecordOfflineResponses } from "./can-record-offline-responses.js";

/**
 * Whether the requester may delete this Offline Response.
 *
 * The single place that decides it: a Referral Coordinator deletes the ones
 * she recorded; a Referral Coordinator who is also an Admin may delete any.
 *
 * @param recordedBy - uid of the Referral Coordinator who recorded it
 */
export function canDeleteOfflineResponse(
  decodedToken: DecodedIdToken,
  recordedBy: string,
): boolean {
  if (!canRecordOfflineResponses(decodedToken)) return false;
  return decodedToken["admin"] === true || recordedBy === decodedToken.uid;
}
