import { createMatchRequestId } from "./create-match-request-id.js";
import { saveContactForm } from "./save-contact-form.js";
import { saveMatchRequest } from "./save-match-request.js";

export const FormStorageService = {
  createMatchRequestId,
  saveContactForm,
  saveMatchRequest,
};

// Re-export for direct imports
export type { MatchRequestDocument } from "../../../collections/match-requests.js";
export type { MessageDocument } from "../../../collections/messages.js";
export { createMatchRequestId } from "./create-match-request-id.js";
export { saveContactForm } from "./save-contact-form.js";
export { saveMatchRequest } from "./save-match-request.js";
export type { ContactFormData, DoulaMatchData } from "./types.js";
