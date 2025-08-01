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

// Initialize only if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

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
