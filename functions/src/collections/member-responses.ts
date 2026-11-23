import type { Timestamp } from "firebase-admin/firestore";

/**
 * Subcollection of a Match Request: one document per Member who responded to
 * the Referral, keyed by the Member's uid
 * (`matchRequests/{requestId}/memberResponses/{memberUid}`).
 */
export const MEMBER_RESPONSES_SUBCOLLECTION = "memberResponses";

/**
 * A Member's response to a Referral. Holds metadata only: the Outreach message
 * body is never stored. Later slices add the Offline Response and the Referral
 * Outcome to the same document, so a document existing does not mean Outreach
 * was sent: only `outreachSentAt` does.
 */
export interface MemberResponseDocument {
  /** The Member's uid (also the document ID), for collection-group queries. */
  memberUid: string;
  /** When Mailgun accepted this Member's Outreach. */
  outreachSentAt?: Timestamp;
  /** Mailgun's id for the Outreach email (absent in the emulator). */
  mailgunMessageId?: string;
  /** Set while an Outreach send is in flight, so a double submit can't send twice. */
  outreachPendingAt?: Timestamp;
}
