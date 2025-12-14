import { saveContactForm } from "./save-contact-form.js";
import { saveMatchRequest } from "./save-match-request.js";

export const FormStorageService = {
  saveContactForm,
  saveMatchRequest,
};

// Re-export for direct imports
export { saveContactForm } from "./save-contact-form.js";
export { saveMatchRequest } from "./save-match-request.js";
export type {
  ContactFormData,
  ContactFormDocument,
  DoulaMatchData,
  DoulaMatchDocument,
} from "./types.js";
