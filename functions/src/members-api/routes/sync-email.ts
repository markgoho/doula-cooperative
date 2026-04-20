import { FieldValue } from "firebase-admin/firestore";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  ForbiddenError,
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { MemberFirestoreService } from "../../shared-api/services/member-firestore/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";

export async function syncEmailLogic({
  memberId,
  authService,
  memberFirestoreService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  authService: AuthService;
  memberFirestoreService: MemberFirestoreService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<{ success: true } | { error: string }> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );

    if (decodedToken.uid !== memberId) {
      throw new ForbiddenError("You can only sync your own email");
    }

    const email = decodedToken.email;
    if (typeof email !== "string" || email === "") {
      throw new ForbiddenError(
        "Authenticated user does not have an email address",
      );
    }

    const document = await memberFirestoreService.getMemberByUid(memberId);
    if (!document.exists) {
      throw new NotFoundError("Member not found");
    }

    const member = document.data() as { email?: unknown };
    if (member.email === email) {
      return { success: true };
    }

    await memberFirestoreService.updateMember(memberId, {
      email,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to sync member email", {
      errorId: ERROR_IDS.UPDATE_MEMBER_NAME_ROUTE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      memberId,
      hasAuthorizationHeader: Boolean(authorizationHeader),
    });

    set.status = 500;
    return { error: "Failed to sync member email" };
  }
}
