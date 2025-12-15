import { getFirestore } from "firebase-admin/firestore";
import {
  IMPORT_COLLECTION,
  type UnclaimedProfileDocument,
} from "../../collections/migrated-users-import.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  toUnclaimedProfileResponse,
  type UnclaimedProfileResponse,
} from "../schemas/unclaimed-profile-schemas.js";

export async function getUnclaimedProfile(options: {
  email: string;
  logger: Logger;
}): Promise<UnclaimedProfileResponse> {
  const { email, logger } = options;

  const firestore = getFirestore();
  const documentReference = firestore.collection(IMPORT_COLLECTION).doc(email);
  const document = await documentReference.get();

  if (!document.exists) {
    logger.warn("Unclaimed profile not found", {
      errorId: ERROR_IDS.API_UNCLAIMED_PROFILE_NOT_FOUND,
      email,
    });
    throw new NotFoundError(`Unclaimed profile with email ${email} not found`);
  }

  const documentData = document.data() as Record<string, unknown>;
  const profile: UnclaimedProfileDocument = {
    ...(documentData as Omit<UnclaimedProfileDocument, "email">),
    email: document.id,
  };

  return toUnclaimedProfileResponse(profile);
}
