import {
  isActiveStripeMember,
  type MemberDocument,
} from "../../types/member-document.js";

/**
 * Referral Notification recipients: Members with an active Stripe membership
 * who have not turned Referral Notifications off (missing means on).
 * Drops blank emails and duplicates.
 */
export function selectRecipientEmails(members: MemberDocument[]): string[] {
  const emails = members
    .filter(
      member =>
        isActiveStripeMember(member) &&
        member.referralNotificationsEnabled !== false,
    )
    .map(member => member.email.trim())
    .filter(email => email.length > 0);

  return [...new Set(emails)];
}
