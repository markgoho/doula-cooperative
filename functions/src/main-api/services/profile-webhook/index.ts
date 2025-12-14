import { findMemberBySlug } from "./find-member-by-slug.js";
import { sendNotificationEmail } from "./send-notification-email.js";
import { validatePayload } from "./validate-payload.js";
import { verifySecret } from "./verify-secret.js";

export const ProfileWebhookService = {
  verifySecret,
  validatePayload,
  findMemberBySlug,
  sendNotificationEmail,
};

// Re-export for direct imports
export { verifySecret } from "./verify-secret.js";
export { validatePayload } from "./validate-payload.js";
export { findMemberBySlug } from "./find-member-by-slug.js";
export { sendNotificationEmail } from "./send-notification-email.js";
export type {
  WebhookPayload,
  MemberInfo,
  NotificationParameters,
  ValidationResult,
} from "./types.js";
