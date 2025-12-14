/**
 * Contact form input data (without metadata like submitted timestamp).
 * Used for API validation and as input to saveContactForm.
 */
export interface ContactFormData {
  contactName: string;
  email: string;
  message: string;
}

/**
 * Doula match form input data (without metadata like submitted timestamp).
 * Used for API validation and as input to saveMatchRequest.
 */
export interface DoulaMatchData {
  name: string;
  phone: string;
  email: string;
  zipcode: string;
  estimatedDueDate: {
    month: string;
    day: string;
    year: string;
  };
  services: string[];
  birthLocation: string;
  otherInfo: string;
  insurance: string[];
}
