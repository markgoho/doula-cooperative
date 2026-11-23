import { formatDueDate } from './format-due-date';
import { formatServices } from './format-services';
import type { OutreachSender, ReferralDetail } from './referral.types';

/**
 * The editable message the Outreach composer starts with: a greeting with the
 * requester's first name, your name, and your Doula Profile link when published.
 */
export function buildOutreachTemplate(
  referral: Pick<ReferralDetail, 'firstName' | 'services' | 'estimatedDueDate'>,
  sender: OutreachSender,
): string {
  const greeting = referral.firstName ? `Hi ${referral.firstName},` : 'Hi there,';
  const introduction = sender.name
    ? `I'm ${sender.name}, a doula with the Rochester Doula Cooperative.`
    : "I'm a doula with the Rochester Doula Cooperative.";

  const services = formatServices(referral.services).toLowerCase();
  const support = services ? `${services} support` : 'doula support';
  const dueDate = formatDueDate(referral.estimatedDueDate);
  const timing = dueDate ? ` around ${dueDate}` : '';
  const request = `I saw your request for ${support}${timing} and I'd love to talk about how I can help.`;

  const profile = sender.profileUrl
    ? `You can read more about me here: ${sender.profileUrl}`
    : undefined;
  const signOff = ['Warmly,', sender.name].filter(Boolean).join('\n');

  return [
    greeting,
    `${introduction} ${request}`,
    profile,
    'Just reply to this email, or let me know a good time to call.',
    signOff,
  ]
    .filter(Boolean)
    .join('\n\n');
}
