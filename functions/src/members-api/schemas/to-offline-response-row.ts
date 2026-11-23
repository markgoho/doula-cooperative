import type { DecodedIdToken } from "firebase-admin/auth";
import type { Timestamp } from "firebase-admin/firestore";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import { canDeleteOfflineResponse } from "../access/can-delete-offline-response.js";
import type { OfflineResponseRow } from "./referral-schemas.js";

/**
 * One Offline Response as the Coordinator panel lists it: the doula, when and
 * by whom it was recorded, and whether the viewer may delete it.
 *
 * @param names - Member name by uid; a missing recorder name becomes ""
 */
export function toOfflineResponseRow({
  recordedBy,
  recordedAt,
  names,
  decodedToken,
  ...row
}: Pick<OfflineResponseRow, "kind" | "id" | "displayName" | "outcome"> & {
  recordedBy: string;
  recordedAt: Timestamp;
  names: Map<string, string>;
  decodedToken: DecodedIdToken;
}): OfflineResponseRow {
  return {
    ...row,
    recordedAt: timestampToIso(recordedAt),
    recordedByName: names.get(recordedBy) ?? "",
    canDelete: canDeleteOfflineResponse(decodedToken, recordedBy),
  };
}
