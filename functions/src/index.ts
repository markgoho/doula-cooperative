/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { MAILERLITE_SECRETS } from "./constants/mailerlite-secrets.js";
import { MAILGUN_SECRETS } from "./constants/mailgun-secrets.js";
import { PROFILE_SECRETS } from "./constants/profile-secrets.js";
import { STRIPE_SECRETS } from "./constants/stripe.js";

// Initialize only if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

// Elysia-based APIs

// Members APIs (members.doulacooperative.com)
export const membersApi = onRequest(
  {
    invoker: "public",
    secrets: [...MAILERLITE_SECRETS, ...MAILGUN_SECRETS],
  },
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
  { invoker: "public", secrets: [...MAILGUN_SECRETS] },
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
