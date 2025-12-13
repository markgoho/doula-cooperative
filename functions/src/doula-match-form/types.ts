import { type Request } from "firebase-functions/v2/https";

export interface DoulaMatchForm {
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
  recaptchaToken?: string;
}

export interface DoulaMatchFormRequest extends Request {
  body: DoulaMatchForm;
}

export interface DoulaMatchFormDocument extends DoulaMatchForm {
  submitted: string;
  sent: boolean;
  recaptchaScore?: number;
}
