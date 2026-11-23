export interface ReferralDueDate {
  month: string;
  day: string;
  year: string;
}

/** A Referral as listed in the inbox. No requester name or contact details. */
export interface ReferralListItem {
  id: string;
  submitted: string;
  estimatedDueDate: ReferralDueDate;
  services: string[];
  /** "City, ST" from the ZIP code; empty when no ZIP code. */
  area: string;
  /** Distinct doulas who sent Outreach or have an Offline Response. */
  responseCount: number;
}

/**
 * The pre-Outreach view of a Referral: first name only.
 * The requester's full name, email and phone are never sent.
 */
export interface ReferralDetail {
  id: string;
  firstName: string;
  zipcode: string;
  area: string;
  prefersSpanish: boolean;
  responseCount: number;
  estimatedDueDate: ReferralDueDate;
  services: string[];
  birthLocation: string;
  otherInfo: string;
  insurance: string[];
  submitted: string;
}
