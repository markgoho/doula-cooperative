import type { ReferralDueDate } from './referral.types';
import { isValidDueDate, parseDueDate } from './referral.utilities';

const DUE_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "Mar 15, 2027", or `undefined` when the requester gave no usable due date. */
export function formatDueDate(dueDate: ReferralDueDate): string | undefined {
  if (!isValidDueDate(dueDate)) return undefined;
  return DUE_DATE_FORMAT.format(parseDueDate(dueDate));
}
