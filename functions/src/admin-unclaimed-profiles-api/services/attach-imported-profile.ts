import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { IMPORT_COLLECTION, MEMBERS_COLLECTION } from "../../collections/index.js";
import { HttpError, NotFoundError } from "../../shared-api/errors/http-error.js";
import { EmailService } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { AuthUpdateService } from "../../profiles-api/services/auth-update/index.js";
import { ClaimProfileFirestoreService } from "../../profiles-api/services/firestore/index.js";
import { applyImportedMemberMerge } from "../../profiles-api/services/imported-member-merge/index.js";

export async function attachImportedProfile({
  email,
  memberUid,
  logger,
}: {
  email: string;
  memberUid: string;
  logger: Logger;
}): Promise<{ success: true; memberUid: string; email: string; status: "merged" }> {
  const database = getFirestore();
  const auth = getAuth();

  const [importDocument, memberDocument, authUser] = await Promise.all([
    database.collection(IMPORT_COLLECTION).doc(email).get(),
    database.collection(MEMBERS_COLLECTION).doc(memberUid).get(),
    auth.getUser(memberUid),
  ]);

  if (!importDocument.exists) {
    throw new NotFoundError("Imported legacy record not found.");
  }

  if (!memberDocument.exists) {
    throw new NotFoundError("Paid member account not found.");
  }

  const mergeResult = await applyImportedMemberMerge({
    uid: memberUid,
    email,
    emailService: EmailService,
    firestoreService: ClaimProfileFirestoreService,
    authUpdateService: AuthUpdateService,
    logger,
    source: "admin_manual_attach",
  });

  if (mergeResult.status === "not_found") {
    throw new NotFoundError("Imported legacy record not found.");
  }

  if (mergeResult.status === "invalid_import_data") {
    throw new HttpError(
      mergeResult.warning ??
        "Imported legacy record is missing required data. Please review it before attaching.",
      500,
    );
  }

  logger.info("Admin attached imported member record", {
    memberUid,
    email,
    authEmail: authUser.email,
  });

  return {
    success: true,
    memberUid,
    email,
    status: "merged",
  };
}
