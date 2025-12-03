/**
 * Match requests collection: stores doula match form submissions
 */
export const MATCH_REQUESTS_COLLECTION = "matchRequests";

export interface MatchRequestDocument {
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
  submitted: string;
  sent: boolean;
  recaptchaScore?: number;
}
