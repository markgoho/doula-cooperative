import type { ContactFormData, DoulaMatchData } from "./types.js";

/**
 * Service interface for form storage operations.
 * Defines the contract for saving form submissions to Firestore.
 */
export interface FormStorageService {
  /**
   * Save a contact form submission to Firestore.
   *
   * @param options - Form data and reCAPTCHA score
   */
  saveContactForm(options: {
    data: ContactFormData;
    recaptchaScore: number;
  }): Promise<void>;

  /**
   * Save a doula match request submission to Firestore.
   *
   * @param options - Match request data and reCAPTCHA score
   */
  saveMatchRequest(options: {
    data: DoulaMatchData;
    recaptchaScore: number;
  }): Promise<void>;
}
