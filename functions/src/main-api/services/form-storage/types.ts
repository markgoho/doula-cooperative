export interface ContactFormData {
  contactName: string;
  email: string;
  message: string;
}

export interface ContactFormDocument extends ContactFormData {
  submitted: string;
  sent: boolean;
  recaptchaScore: number;
}

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

export interface DoulaMatchDocument extends DoulaMatchData {
  submitted: string;
  sent: boolean;
  recaptchaScore: number;
}
