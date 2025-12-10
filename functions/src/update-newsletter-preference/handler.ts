import { onCall, type CallableRequest } from "firebase-functions/v2/https";

interface UpdateNewsletterPreferenceData {
  subscribed: boolean;
}

export const updateNewsletterPreference = onCall(async (request) => {
  const { handleUpdateNewsletterPreference } = await import(
    "./update-newsletter-preference.js"
  );
  return handleUpdateNewsletterPreference(
    request as CallableRequest<UpdateNewsletterPreferenceData>,
  );
});
