import { saveContactForm } from "./save-contact-form.js";
import { saveMatchRequest } from "./save-match-request.js";

export const FormStorageService = {
  saveContactForm,
  saveMatchRequest,
};

// Re-export for direct imports
export type { MatchRequestDocument } from "@doula-coop/functions-shared/collections/match-requests.js";
export type { MessageDocument } from "@doula-coop/functions-shared/collections/messages.js";
export { saveContactForm } from "./save-contact-form.js";
export { saveMatchRequest } from "./save-match-request.js";
export type { ContactFormData, DoulaMatchData } from "./types.js";
