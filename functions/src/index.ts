/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { auth } from "firebase-functions/v1";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { PROFILE_SECRETS } from "./constants/profile-secrets";

// Initialize only if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

export const contactUsForm = onRequest(
  { invoker: "public" },
  async (request, response) => {
    const { handleContactUsForm } = await import(
      "./contact-us-form/contact-us-form.js"
    );
    await handleContactUsForm(request, response);
  },
);

export const doulaMatchForm = onRequest(
  { invoker: "public" },
  async (request, response) => {
    const { handleDoulaMatchForm } = await import(
      "./doula-match-form/doula-match-form.js"
    );
    await handleDoulaMatchForm(request, response);
  },
);

export const emailContactForm = onDocumentCreated(
  { document: "messages/{messageId}", secrets: ["MAILGUN_API_KEY"] },
  async event => {
    const apiKey = process.env.MAILGUN_API_KEY;
    const { handleDocumentCreated } = await import(
      "./contact-us-form/email-contact-form.js"
    );
    await handleDocumentCreated(event, apiKey);
  },
);

export const emailDoulaMatch = onDocumentCreated(
  { document: "matchRequests/{matchRequestId}", secrets: ["MAILGUN_API_KEY"] },
  async event => {
    const apiKey = process.env.MAILGUN_API_KEY;
    const { handleDocumentCreated } = await import(
      "./doula-match-form/email-doula-match.js"
    );
    await handleDocumentCreated(event, apiKey);
  },
);

export const createMemberOnUserCreated = auth.user().onCreate(async user => {
  const { handleUserCreated } = await import(
    "./user-creation/user-creation.js"
  );
  await handleUserCreated(user);
});

export const deleteMemberOnUserDeleted = auth.user().onDelete(async user => {
  const { handleUserDeleted } = await import(
    "./user-deletion/user-deletion.js"
  );
  await handleUserDeleted(user);
});

export const claimProfile = onCall({ invoker: "public" }, async request => {
  const { handleClaimProfile } = await import("./claim-profile/index.js");
  return handleClaimProfile(request.data, request);
});

export const readProfile = onCall(
  { invoker: "public", secrets: PROFILE_SECRETS },
  async request => {
    const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
    const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY;
    const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID;

    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
      throw new HttpsError("internal", "Missing GitHub secrets.");
    }

    const { handleReadProfile } = await import("./read-profile/index.js");
    return handleReadProfile(request, [
      GITHUB_APP_ID,
      GITHUB_PRIVATE_KEY,
      GITHUB_INSTALLATION_ID,
    ]);
  },
);

export { stripeWebhook } from "./stripe-webhook/index.js";

// Admin functions
export const setAdminClaim = onCall({ invoker: "public" }, async request => {
  const { handleSetAdminClaim } = await import("./admin/set-admin-claim.js");
  return handleSetAdminClaim(request.data as { uid: string }, request);
});

export const removeAdminClaim = onCall({ invoker: "public" }, async request => {
  const { handleRemoveAdminClaim } = await import(
    "./admin/remove-admin-claim.js"
  );
  return handleRemoveAdminClaim(request.data as { uid: string }, request);
});

export const adminListMembers = onCall({ invoker: "public" }, async request => {
  const { handleListMembers } = await import("./admin/list-members.js");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return handleListMembers(request.data, request);
});

export const adminGetMember = onCall({ invoker: "public" }, async request => {
  const { handleGetMember } = await import("./admin/get-member.js");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return handleGetMember(request.data, request);
});

export const adminUpdateMember = onCall({ invoker: "public" }, async request => {
  const { handleUpdateMember } = await import("./admin/update-member.js");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return handleUpdateMember(request.data, request);
});

export const adminActivateMembership = onCall(
  { invoker: "public" },
  async request => {
    const { handleActivateMembership } = await import(
      "./admin/activate-membership.js"
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleActivateMembership(request.data, request);
  },
);

export const adminDeactivateMembership = onCall(
  { invoker: "public" },
  async request => {
    const { handleDeactivateMembership } = await import(
      "./admin/deactivate-membership.js"
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleDeactivateMembership(request.data, request);
  },
);

export const adminExtendMembership = onCall(
  { invoker: "public" },
  async request => {
    const { handleExtendMembership } = await import(
      "./admin/extend-membership.js"
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleExtendMembership(request.data, request);
  },
);

export const adminReadMemberProfile = onCall(
  { invoker: "public", secrets: PROFILE_SECRETS },
  async request => {
    const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
    const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY;
    const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID;

    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
      throw new HttpsError("internal", "Missing GitHub secrets.");
    }

    const { handleAdminReadMemberProfile } = await import(
      "./admin/read-member-profile.js"
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleAdminReadMemberProfile(request.data, request, [
      GITHUB_APP_ID,
      GITHUB_PRIVATE_KEY,
      GITHUB_INSTALLATION_ID,
    ]);
  },
);
