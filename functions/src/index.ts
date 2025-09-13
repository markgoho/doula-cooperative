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
import { onCall, onRequest } from "firebase-functions/v2/https";

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
  { document: "matchRequests/{requestId}", secrets: ["MAILGUN_API_KEY"] },
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

export const setUserEmailVerified = onCall(
  { invoker: "public" },
  async request => {
    const { handleSetUserEmailVerified } = await import(
      "./set-user-email-verified/set-user-email-verified.js"
    );
    return await handleSetUserEmailVerified(request);
  },
);

export const claimProfile = onCall(
  {
    enforceAppCheck: true, // Enable App Check
  },
  async request => {
    const { handleClaimProfile: handler } = await import(
      "./claim-profile/claim-profile.js"
    );
    return handler(request);
  },
);
