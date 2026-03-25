import { logger } from "firebase-functions/v2";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import { MemberFirestoreService } from "../../shared-api/services/member-firestore/index.js";
import type { MemberDocument } from "../../types/member-document.js";
import { verifyMemberExists } from "./verify-member-exists.js";

export interface SetProfileEditingPermissionResult {
  member: MemberDocument;
}

/**
 * Set whether a member can create or edit a profile.
 *
 * @param options.memberId - The Firestore document ID of the member
 * @param options.allowProfileEditing - Whether profile editing is allowed
 * @returns The updated member document
 * @throws NotFoundError if member does not exist
 */
export async function approveProfile(options: {
  memberId: string;
  allowProfileEditing: boolean;
}): Promise<SetProfileEditingPermissionResult> {
  const { memberId, allowProfileEditing } = options;

  try {
    await verifyMemberExists(memberId);

    await MemberFirestoreService.updateMember(memberId, {
      allowProfileEditing,
    });

    const updatedMemberDocument = await MemberFirestoreService.getMemberByUid(
      memberId,
    );
    if (!updatedMemberDocument.exists) {
      throw new HttpError(
        `Member with ID ${memberId} not found in ${MEMBERS_COLLECTION}`,
        404,
      );
    }

    const updatedMember = updatedMemberDocument.data() as MemberDocument;

    const member = {
      ...updatedMember,
      uid: updatedMemberDocument.id,
    };

    logger.info("Updated member profile editing permission", {
      memberId,
      allowProfileEditing,
    });

    return {
      member,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to update member profile editing permission", {
      errorId: ERROR_IDS.API_ADMIN_UPDATE_MEMBER_FAILED,
      memberId,
      allowProfileEditing,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to update member profile editing permission", 500);
  }
}
