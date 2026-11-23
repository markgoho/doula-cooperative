const OPEN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** How much longer a Referral stays open to new Outreach, from its submitted time. */
export function formatDaysOpen(submitted: string, now: Date = new Date()): string {
  const closesAt = new Date(submitted).getTime() + OPEN_DAYS * DAY_MS;
  const daysLeft = Math.ceil((closesAt - now.getTime()) / DAY_MS);
  if (daysLeft <= 0) return 'Closed to new Outreach';
  if (daysLeft === 1) return 'Open 1 more day';
  return `Open ${daysLeft} more days`;
}
