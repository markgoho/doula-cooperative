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
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { MAILERLITE_SECRETS } from "./constants/mailerlite-secrets.js";
import { MAILGUN_SECRETS } from "./constants/mailgun-secrets.js";
import { PROFILE_SECRETS } from "./constants/profile-secrets.js";
import { STRIPE_SECRETS } from "./constants/stripe.js";

// Initialize only if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

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

    const { handleUpdateNewsletterPreference } =
      await import("./update-newsletter-preference/update-newsletter-preference.js");
    return handleUpdateNewsletterPreference(
      request,
      MAILERLITE_API_KEY,
      MAILGUN_API_KEY,
    );
  },
);

// Admin functions
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

// Elysia-based APIs

// Members APIs (members.doulacooperative.com)
export const membersApi = onRequest(
  { invoker: "public" },
  async (request, response) => {
    const { handleMembersApi } = await import("./members-api/handler.js");
    await handleMembersApi(request, response);
  },
);

// Admin Members APIs (members.doulacooperative.com)
export const adminMembersApi = onRequest(
  { invoker: "public" },
  async (request, response) => {
    const { handleAdminMembersApi } =
      await import("./admin-members-api/handler.js");
    await handleAdminMembersApi(request, response);
  },
);

// Admin Match Requests API (members.doulacooperative.com)
export const adminMatchRequestsApi = onRequest(
  { invoker: "public" },
  async (request, response) => {
    const { handleAdminMatchRequestsApi } =
      await import("./admin-match-requests-api/handler.js");
    await handleAdminMatchRequestsApi(request, response);
  },
);

// Admin Messages API (members.doulacooperative.com)
export const adminMessagesApi = onRequest(
  { invoker: "public" },
  async (request, response) => {
    const { handleAdminMessagesApi } =
      await import("./admin-messages-api/handler.js");
    await handleAdminMessagesApi(request, response);
  },
);

// Admin Unclaimed Profiles API (members.doulacooperative.com)
export const adminUnclaimedProfilesApi = onRequest(
  { invoker: "public" },
  async (request, response) => {
    const { handleAdminUnclaimedProfilesApi } =
      await import("./admin-unclaimed-profiles-api/handler.js");
    await handleAdminUnclaimedProfilesApi(request, response);
  },
);

// Profiles API (members.doulacooperative.com)
export const profilesApi = onRequest(
  { invoker: "public", secrets: PROFILE_SECRETS },
  async (request, response) => {
    const { handleProfilesApi } = await import("./profiles-api/handler.js");
    await handleProfilesApi(request, response);
  },
);

// Forms API (doulacooperative.com)
export const formsApi = onRequest(
  { invoker: "public", secrets: ["RECAPTCHA_SECRET_KEY", "MAILGUN_API_KEY"] },
  async (request, response) => {
    const { handleFormsApi } = await import("./forms-api/handler.js");
    await handleFormsApi(request, response);
  },
);

// Stripe Webhook API (doulacooperative.com)
export const stripeWebhookApi = onRequest(
  {
    invoker: "public",
    secrets: [...STRIPE_SECRETS, "MAILERLITE_API_KEY", "MAILGUN_API_KEY"],
  },
  async (request, response) => {
    const { handleStripeWebhookApi } =
      await import("./stripe-webhook-api/handler.js");
    await handleStripeWebhookApi(request, response);
  },
);

// Profile Webhook API (doulacooperative.com)
export const profileWebhookApi = onRequest(
  {
    invoker: "public",
    secrets: ["DEPLOY_WEBHOOK_SECRET", "MAILGUN_API_KEY"],
  },
  async (request, response) => {
    const { handleProfileWebhookApi } =
      await import("./profile-webhook-api/handler.js");
    await handleProfileWebhookApi(request, response);
  },
);

// Legacy alias for backward compatibility during migration
export const api = membersApi;
