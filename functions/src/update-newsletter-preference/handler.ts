import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const mailerliteApiKey = defineSecret("MAILERLITE_API_KEY");
const mailgunApiKey = defineSecret("MAILGUN_API_KEY");

interface UpdateNewsletterPreferenceData {
  subscribed: boolean;
}

export const updateNewsletterPreference = onCall(
  {
    invoker: "public",
    secrets: [mailerliteApiKey, mailgunApiKey],
  },
  async (request) => {
    const { handleUpdateNewsletterPreference } = await import(
      "./update-newsletter-preference.js"
    );
    return handleUpdateNewsletterPreference(
      request as CallableRequest<UpdateNewsletterPreferenceData>,
    );
  },
);
