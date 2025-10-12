import { type Request } from "firebase-functions/v2/https";

export interface ContactUsForm {
  contactName: string;
  email: string;
  message: string;
}

export interface ContactUsFormRequest extends Request {
  body: ContactUsForm;
}

export interface ContactUsFormDocument extends ContactUsForm {
  submitted: string;
  sent: boolean;
}

// Mock Response for testing HTTP functions
// This is a minimal mock that implements only the methods we need for testing
export interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  set(key: string, value: string): MockResponse;
  status(code: number): MockResponse;
  send(body: unknown): MockResponse;
}
