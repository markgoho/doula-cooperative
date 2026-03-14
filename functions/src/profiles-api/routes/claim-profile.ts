import { ERROR_IDS } from "../../constants/error-ids.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ClaimProfileResponse } from "../schemas/profile-schemas.js";
import type { AuthUpdateService } from "../services/auth-update/interface.js";
import type { ClaimProfileFirestoreService } from "../services/firestore/interface.js";
import { applyImportedMemberMerge } from "../services/imported-member-merge/index.js";

/**
 * Claim an unclaimed profile for the authenticated user.
 * This function:
 * 1. Looks for a matching document in the import collection
 * 2. Creates/updates the member document with the profile data
 * 3. Calculates membership expiration date
 * 4. Subscribes user to newsletter (non-critical)
 * 5. Updates auth displayName if profile has name
 * 6. Deletes the import document
 */
export async function claimProfileLogic({
  uid,
  email,
  emailVerified,
  emailService,
  claimProfileFirestoreService,
  authUpdateService,
  logger,
  set,
}: {
  uid: string;
  email: string;
  emailVerified: boolean;
  emailService: EmailServiceInterface;
  claimProfileFirestoreService: ClaimProfileFirestoreService;
  authUpdateService: AuthUpdateService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ClaimProfileResponse> {
  // Ensure the user's email is verified
  if (!emailVerified) {
    set.status = 428;
    return {
      error: "The user must have a verified email to claim a profile.",
    };
  }

  try {
    const mergeResult = await applyImportedMemberMerge({
      uid,
      email,
      emailService,
      firestoreService: claimProfileFirestoreService,
      authUpdateService,
      logger,
      source: "claim_profile",
    });

    if (mergeResult.status === "not_found") {
      logger.info(`No profile to claim for user: ${email}`);
      return { status: "no_profile_to_claim" };
    }

    if (mergeResult.status === "invalid_import_data") {
      set.status = 500;
      return {
        error:
          mergeResult.warning ??
          "Your imported profile is missing required information. Please contact support.",
      };
    }

    if (
      !mergeResult.mergedFields?.email ||
      !mergeResult.mergedFields.name ||
      !mergeResult.mergedFields.subscriptionStart ||
      !mergeResult.mergedFields.lastPayment ||
      !mergeResult.mergedFields.membershipExpiresAt
    ) {
      set.status = 500;
      return {
        error:
          "Your imported profile is missing required information. Please contact support.",
      };
    }

    const mergedFields = mergeResult.mergedFields as {
      email: string;
      name: string;
      subscriptionStart: unknown;
      lastPayment: unknown;
      membershipExpiresAt: unknown;
      slug?: string;
      profileCreatedAt?: unknown;
    };
    const {
      email: mergedEmail,
      name,
      subscriptionStart,
      lastPayment,
      membershipExpiresAt,
    } = mergedFields;

    return {
      status: "success",
      data: {
        email: mergedEmail,
        name,
        ...(mergedFields.slug !== undefined && { slug: mergedFields.slug }),
        subscriptionStart,
        lastPayment,
        nextPayment: membershipExpiresAt,
        ...(mergedFields.profileCreatedAt !== undefined && {
          createdAt: mergedFields.profileCreatedAt,
        }),
      },
    };
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "claim profile",
      errorId: ERROR_IDS.CLAIM_PROFILE_FAILED,
      logger,
      set,
      context: { uid, email },
    });
  }
}
