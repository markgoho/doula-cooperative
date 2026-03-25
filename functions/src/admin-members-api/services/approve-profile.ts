import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import { MemberFirestoreService } from "../../shared-api/services/member-firestore/index.js";
import type { MemberDocument } from "../../types/member-document.js";
import { verifyMemberExists } from "./verify-member-exists.js";

export interface ApproveProfileResult {
  member: MemberDocument;
}

/**
 * Approve a member to create or edit a profile.
 * Sets profileApprovedAt to the current server timestamp.
 *
 * @param options.memberId - The Firestore document ID of the member
 * @returns The updated member document
 * @throws NotFoundError if member does not exist
 */
export async function approveProfile(options: {
  memberId: string;
}): Promise<ApproveProfileResult> {
  const { memberId } = options;

  try {
    await verifyMemberExists(memberId);

    await MemberFirestoreService.updateMember(memberId, {
      profileApprovedAt: FieldValue.serverTimestamp(),
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

    logger.info("Approved member for profile work", { memberId });

    return {
      member,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to approve member for profile work", {
      errorId: ERROR_IDS.API_ADMIN_UPDATE_MEMBER_FAILED,
      memberId,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to approve member for profile work", 500);
  }
}
