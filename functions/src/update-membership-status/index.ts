import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export interface UpdateMembershipStatusData {
  userId: string;
  membershipActive: boolean;
  expiresInOneYear?: boolean;
}

export const handleUpdateMembershipStatus = async (
  data: unknown,
  context: CallableRequest,
) => {
  // 1. Ensure the user is authenticated.
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  // 2. Check if the user is an admin.
  const adminUser = await getAuth().getUser(context.auth.uid);
  if (!adminUser.customClaims?.admin) {
    throw new HttpsError(
      "permission-denied",
      "Only administrators can update membership status.",
    );
  }

  const { userId, membershipActive, expiresInOneYear } =
    data as UpdateMembershipStatusData;

  const database = getFirestore();
  const memberDocumentReference = database.collection("members").doc(userId);

  try {
    const updateData: {
      membershipActive: boolean;
      membershipExpiresAt?: Timestamp;
    } = {
      membershipActive,
    };

    if (expiresInOneYear) {
      const now = new Date();
      const oneYearFromNow = new Date(now.setFullYear(now.getFullYear() + 1));
      updateData.membershipExpiresAt = Timestamp.fromDate(oneYearFromNow);
    }

    await memberDocumentReference.update(updateData);

    logger.log(
      `Successfully updated membership status for user: ${userId} to ${String(
        membershipActive,
      )}`,
    );
    return { status: "success" };
  } catch (error) {
    logger.error("Error updating membership status:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while updating the membership status.",
    );
  }
};
