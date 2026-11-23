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
  /** Under 14 days old. Older Referrals are listed only when you reached out. */
  isOpen: boolean;
  /** Present when you sent Outreach on this Referral. */
  outreach?: ReferralOutreach;
}

/** Your own Outreach on a Referral. */
export interface ReferralOutreach {
  /** ISO 8601 time Mailgun accepted it. */
  sentAt: string;
}

/** The requester's contact details, sent only after your Outreach. */
export interface ReferralContact {
  fullName: string;
  email: string;
  phone: string;
}

/** Who your Outreach comes from, for the composer template. */
export interface OutreachSender {
  name: string;
  email: string;
  profileUrl?: string;
}

/** Result of a sent Outreach. */
export interface SentOutreach {
  outreach: ReferralOutreach;
  contact: ReferralContact;
}

/**
 * A Referral's detail. Before your Outreach: first name only, never the
 * requester's full name, email or phone. After it: `outreach` and `contact`.
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
  outreach?: ReferralOutreach;
  contact?: ReferralContact;
  /** Present before your Outreach when you can send it. */
  outreachSender?: OutreachSender;
}
