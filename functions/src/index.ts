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
import {
  type CallableRequest,
  HttpsError,
  onCall,
  onRequest,
} from "firebase-functions/v2/https";
import { MAILERLITE_SECRETS } from "./constants/mailerlite-secrets.js";
import { MAILGUN_SECRETS } from "./constants/mailgun-secrets.js";
import { PROFILE_SECRETS } from "./constants/profile-secrets.js";
import { type ProfileData } from "./types/profile-data.js";

// Initialize only if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

export const contactUsForm = onRequest(
  { invoker: "public", secrets: ["RECAPTCHA_SECRET_KEY"] },
  async (request, response) => {
    const RECAPTCHA_SECRET_KEY = process.env["RECAPTCHA_SECRET_KEY"];

    if (!RECAPTCHA_SECRET_KEY) {
      response.status(500).send({ error: "Server configuration error" });
      return;
    }

    const { handleContactUsForm } =
      await import("./contact-us-form/contact-us-form.js");
    await handleContactUsForm(request, response, RECAPTCHA_SECRET_KEY);
  },
);

export const doulaMatchForm = onRequest(
  { invoker: "public", secrets: ["RECAPTCHA_SECRET_KEY"] },
  async (request, response) => {
    const RECAPTCHA_SECRET_KEY = process.env["RECAPTCHA_SECRET_KEY"];

    if (!RECAPTCHA_SECRET_KEY) {
      response.status(500).send({ error: "Server configuration error" });
      return;
    }

    const { handleDoulaMatchForm } =
      await import("./doula-match-form/doula-match-form.js");
    await handleDoulaMatchForm(request, response, RECAPTCHA_SECRET_KEY);
  },
);

export const emailContactForm = onDocumentCreated(
  { document: "messages/{messageId}", secrets: ["MAILGUN_API_KEY"] },
  async event => {
    const apiKey = process.env["MAILGUN_API_KEY"];
    const { handleDocumentCreated } =
      await import("./contact-us-form/email-contact-form.js");
    await handleDocumentCreated(event, apiKey);
  },
);

export const emailDoulaMatch = onDocumentCreated(
  { document: "matchRequests/{matchRequestId}", secrets: ["MAILGUN_API_KEY"] },
  async event => {
    const apiKey = process.env["MAILGUN_API_KEY"];
    const { handleDocumentCreated } =
      await import("./doula-match-form/email-doula-match.js");
    await handleDocumentCreated(event, apiKey);
  },
);

export const createMemberOnUserCreated = auth.user().onCreate(async user => {
  const { handleUserCreated } =
    await import("./user-creation/user-creation.js");
  await handleUserCreated(user);
});

export const deleteMemberOnUserDeleted = auth.user().onDelete(async user => {
  const { handleUserDeleted } =
    await import("./user-deletion/user-deletion.js");
  await handleUserDeleted(user);
});

export const setAutoAdminOnUserCreated = auth.user().onCreate(async user => {
  const { handleSetAutoAdmin } =
    await import("./user-creation/set-auto-admin.js");
  await handleSetAutoAdmin(user);
});

export const claimProfile = onCall(
  {
    invoker: "public",
    secrets: [...MAILERLITE_SECRETS, ...MAILGUN_SECRETS],
  },
  async request => {
    const { handleClaimProfile } = await import("./claim-profile/index.js");
    return handleClaimProfile(request.data, request);
  },
);

export const checkSlugAvailable = onCall(
  { invoker: "public" },
  async (request: CallableRequest<{ slug: string }>) => {
    const { handleCheckSlugAvailable } =
      await import("./check-slug-available/index.js");
    return handleCheckSlugAvailable(request);
  },
);

export const setProfileSlug = onCall(
  { invoker: "public" },
  async (request: CallableRequest<{ slug: string }>) => {
    const { handleSetProfileSlug } =
      await import("./set-profile-slug/index.js");
    return handleSetProfileSlug(request);
  },
);

export const readProfile = onCall(
  { invoker: "public", secrets: PROFILE_SECRETS },
  async request => {
    const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
    const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
    const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

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

export const writeProfile = onCall(
  { invoker: "public", secrets: PROFILE_SECRETS },
  async (request: CallableRequest<ProfileData>) => {
    const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
    const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
    const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
      throw new HttpsError("internal", "Missing GitHub secrets.");
    }

    const { handleWriteProfile } = await import("./write-profile/index.js");
    return handleWriteProfile(request, [
      GITHUB_APP_ID,
      GITHUB_PRIVATE_KEY,
      GITHUB_INSTALLATION_ID,
    ]);
  },
);

export const createProfile = onCall(
  { invoker: "public", secrets: PROFILE_SECRETS },
  async (request: CallableRequest<ProfileData>) => {
    const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
    const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
    const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
      throw new HttpsError("internal", "Missing GitHub secrets.");
    }

    const { handleCreateProfile } = await import("./create-profile/index.js");
    return handleCreateProfile(request, [
      GITHUB_APP_ID,
      GITHUB_PRIVATE_KEY,
      GITHUB_INSTALLATION_ID,
    ]);
  },
);

export { uploadProfileImage } from "./upload-profile-image/index.js";

export { deleteProfileImage } from "./delete-profile-image/index.js";

export { stripeWebhook } from "./stripe-webhook/index.js";

export { profileDeploymentWebhook } from "./profile-deployment-webhook/index.js";

export const updateNewsletterPreference = onCall<{ subscribed: boolean }>(
  {
    invoker: "public",
    secrets: [...MAILERLITE_SECRETS, ...MAILGUN_SECRETS],
  },
  async request => {
    const MAILERLITE_API_KEY = process.env["MAILERLITE_API_KEY"];
    const MAILGUN_API_KEY = process.env["MAILGUN_API_KEY"];

    if (!MAILERLITE_API_KEY) {
      throw new HttpsError(
        "failed-precondition",
        "Newsletter service not configured. Please contact support.",
      );
    }

    const { handleUpdateNewsletterPreference } = await import(
      "./update-newsletter-preference/update-newsletter-preference.js"
    );
    return handleUpdateNewsletterPreference(
      request,
      MAILERLITE_API_KEY,
      MAILGUN_API_KEY,
    );
  },
);

// Admin functions
export const setAdminClaim = onCall({ invoker: "public" }, async request => {
  const { handleSetAdminClaim } = await import("./admin/set-admin-claim.js");
  return handleSetAdminClaim(request.data as { uid: string }, request);
});

export const removeAdminClaim = onCall({ invoker: "public" }, async request => {
  const { handleRemoveAdminClaim } =
    await import("./admin/remove-admin-claim.js");
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

export const adminUpdateMember = onCall(
  { invoker: "public" },
  async request => {
    const { handleUpdateMember } = await import("./admin/update-member.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleUpdateMember(request.data, request);
  },
);

export const adminActivateMembership = onCall(
  { invoker: "public" },
  async request => {
    const { handleActivateMembership } =
      await import("./admin/activate-membership.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleActivateMembership(request.data, request);
  },
);

export const adminDeactivateMembership = onCall(
  { invoker: "public" },
  async request => {
    const { handleDeactivateMembership } =
      await import("./admin/deactivate-membership.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleDeactivateMembership(request.data, request);
  },
);

export const adminExtendMembership = onCall(
  { invoker: "public" },
  async request => {
    const { handleExtendMembership } =
      await import("./admin/extend-membership.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleExtendMembership(request.data, request);
  },
);

export const adminReadMemberProfile = onCall(
  { invoker: "public", secrets: PROFILE_SECRETS },
  async request => {
    const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
    const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
    const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
      throw new HttpsError("internal", "Missing GitHub secrets.");
    }

    const { handleAdminReadMemberProfile } =
      await import("./admin/read-member-profile.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleAdminReadMemberProfile(request.data, request, [
      GITHUB_APP_ID,
      GITHUB_PRIVATE_KEY,
      GITHUB_INSTALLATION_ID,
    ]);
  },
);

export const adminListUnclaimedProfiles = onCall(
  { invoker: "public" },
  async request => {
    const { handleListUnclaimedProfiles } =
      await import("./admin/list-unclaimed-profiles.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleListUnclaimedProfiles(request.data, request);
  },
);

export const adminGetUnclaimedProfile = onCall(
  { invoker: "public" },
  async request => {
    const { handleGetUnclaimedProfile } =
      await import("./admin/get-unclaimed-profile.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleGetUnclaimedProfile(request.data, request);
  },
);

export const adminDeleteUser = onCall({ invoker: "public" }, async request => {
  const { handleDeleteUser } = await import("./admin/delete-user.js");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return handleDeleteUser(request.data, request);
});

export const adminSendInvitation = onCall(
  { invoker: "public", secrets: ["MAILGUN_API_KEY"] },
  async request => {
    const apiKey = process.env["MAILGUN_API_KEY"];
    const { handleSendInvitation } = await import("./admin/send-invitation.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleSendInvitation(request.data, request, apiKey);
  },
);

export const adminListMatchRequests = onCall(
  { invoker: "public" },
  async request => {
    const { handleListMatchRequests } =
      await import("./admin/list-match-requests.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleListMatchRequests(request.data, request);
  },
);

export const adminGetMatchRequest = onCall(
  { invoker: "public" },
  async request => {
    const { handleGetMatchRequest } =
      await import("./admin/get-match-request.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleGetMatchRequest(request.data, request);
  },
);

export const adminUpdateMatchRequest = onCall(
  { invoker: "public" },
  async request => {
    const { handleUpdateMatchRequest } =
      await import("./admin/update-match-request.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleUpdateMatchRequest(request.data, request);
  },
);

export const adminListMessages = onCall(
  { invoker: "public" },
  async request => {
    const { handleListMessages } = await import("./admin/list-messages.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleListMessages(request.data, request);
  },
);

export const adminGetMessage = onCall({ invoker: "public" }, async request => {
  const { handleGetMessage } = await import("./admin/get-message.js");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return handleGetMessage(request.data, request);
});

export const adminUpdateMessage = onCall(
  { invoker: "public" },
  async request => {
    const { handleUpdateMessage } = await import("./admin/update-message.js");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return handleUpdateMessage(request.data, request);
  },
);
