export interface WebhookPayload {
  commitMessage: string;
  commitSha: string;
  slug: string; // Empty string if not single profile update
  secret: string;
}
