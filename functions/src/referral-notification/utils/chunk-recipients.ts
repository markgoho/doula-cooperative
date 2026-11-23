/** Mailgun accepts at most 1,000 recipients per batch send. */
const MAILGUN_BATCH_LIMIT = 1000;

export function chunkRecipients(
  emails: string[],
  size = MAILGUN_BATCH_LIMIT,
): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < emails.length; index += size) {
    chunks.push(emails.slice(index, index + size));
  }
  return chunks;
}
