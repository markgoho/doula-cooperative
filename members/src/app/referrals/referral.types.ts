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
  /** Present when the Referral Coordinator recorded that you responded outside the portal. */
  offlineResponse?: OwnOfflineResponse;
  /** Your own Referral Outcome, when you recorded one. */
  outcome?: ReferralOutcome;
  /** Whether any member recorded a hired Referral Outcome. Never says who. */
  hiredBadge: boolean;
}

/** The inbox list, and whether it holds every Referral regardless of age. */
export interface ReferralList {
  referrals: ReferralListItem[];
  /** True for a Referral Coordinator: the list holds every Referral (newest 200). */
  showsAllReferrals: boolean;
}

/** Inbox list filters, as URL slugs. `all` is offered only to Referral Coordinators. */
export type ReferralFilter = 'open' | 'my-outreach' | 'needs-outcome' | 'all';

/** One member's own result for a Referral. Never exclusive to one member. */
export type ReferralOutcome = 'hired' | 'not_hired' | 'not_a_fit';

/** Your Referral Outcome and the hired badge, as the API returns them after a save. */
export interface ReferralOutcomeState {
  outcome?: ReferralOutcome;
  /** ISO 8601 time your Referral Outcome was last set. */
  outcomeUpdatedAt?: string;
  hiredBadge: boolean;
}

/** Your own Outreach on a Referral. */
export interface ReferralOutreach {
  /** ISO 8601 time Mailgun accepted it. */
  sentAt: string;
}

/**
 * The Referral Coordinator's record that you responded outside the portal.
 * Unlocks your Referral Outcome; never reveals contact details.
 */
export interface OwnOfflineResponse {
  /** ISO 8601 time it was recorded. */
  recordedAt: string;
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
 * Always carries your own Referral Outcome (if any) and the hired badge.
 */
export interface ReferralDetail extends ReferralOutcomeState {
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
  /** Under 14 days old. Outreach can only be sent while it is. */
  isOpen: boolean;
  outreach?: ReferralOutreach;
  offlineResponse?: OwnOfflineResponse;
  contact?: ReferralContact;
  /** Present before your Outreach when you can send it. */
  outreachSender?: OutreachSender;
  /** Present only for Referral Coordinators and Admins. */
  coordinator?: ReferralCoordinatorView;
}

/** One member who sent Outreach on a Referral, as the Coordinator panel lists it. */
export interface ReferralResponse {
  memberUid: string;
  /** Empty when the member has no name set. */
  memberName: string;
  /** ISO 8601 time Mailgun accepted their Outreach. */
  outreachSentAt: string;
  outcome?: ReferralOutcome;
  outcomeUpdatedAt?: string;
}

/** A Member, or an Unclaimed Legacy Membership ("Not yet migrated"). */
export type ReferralDoulaKind = 'member' | 'legacy';

/** A doula the Referral Coordinator can name in an Offline Response. */
export interface ReferralDoula {
  kind: ReferralDoulaKind;
  /** A member's uid, or an opaque id for a Legacy Membership. */
  id: string;
  displayName: string;
}

/** One Offline Response on a Referral, as the Coordinator panel lists it. */
export interface OfflineResponseRow {
  kind: ReferralDoulaKind;
  id: string;
  /** Empty when the doula has no name set. */
  displayName: string;
  /** ISO 8601 time it was recorded. */
  recordedAt: string;
  /** Who recorded it; empty when unset. */
  recordedByName: string;
  /** Whether you may delete it. */
  canDelete: boolean;
  /** The member's Referral Outcome, if they recorded one. */
  outcome?: ReferralOutcome;
}

/**
 * The Coordinator-only part of a Referral: who sent Outreach, each member's
 * Referral Outcome, and the Offline Responses. Never the requester's contact
 * details.
 */
export interface ReferralCoordinatorView {
  /** Members who sent Outreach, earliest first. */
  responses: ReferralResponse[];
  /** Offline Responses, earliest first. */
  offlineResponses: OfflineResponseRow[];
  /** Whether you may record Offline Responses (Referral Coordinators only). */
  canRecordOfflineResponses: boolean;
}
