import { type Request } from "firebase-functions/v2/https";

export interface ContactUsForm {
  contactName: string;
  email: string;
  message: string;
  recaptchaToken?: string;
}

export interface ContactUsFormRequest extends Request {
  body: ContactUsForm;
}

export interface ContactUsFormDocument extends ContactUsForm {
  submitted: string;
  sent: boolean;
}
