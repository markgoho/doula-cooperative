const SENT_AT_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** When an Outreach was sent, as "Nov 20, 3:30 PM" in the viewer's time zone. */
export function formatSentAt(sentAt: string): string {
  return SENT_AT_FORMAT.format(new Date(sentAt));
}
