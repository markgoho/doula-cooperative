import type { ContactFormData, DoulaMatchData } from "./types.js";

/**
 * Service interface for form storage operations.
 * Defines the contract for saving form submissions to Firestore.
 */
export interface FormStorageService {
  /**
   * Save a contact form submission to Firestore.
   *
   * @param options - Form data, reCAPTCHA score, and email send status
   */
  saveContactForm(options: {
    data: ContactFormData;
    recaptchaScore: number;
    emailSent?: boolean;
  }): Promise<void>;

  /**
   * Save a doula match request submission to Firestore.
   *
   * @param options - Match request data, reCAPTCHA score, and email send status
   */
  saveMatchRequest(options: {
    data: DoulaMatchData;
    recaptchaScore: number;
    emailSent?: boolean;
  }): Promise<void>;
}
