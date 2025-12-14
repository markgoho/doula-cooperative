import { findMemberBySlug } from "./find-member-by-slug.js";
import type { ProfileWebhookService as ProfileWebhookServiceInterface } from "./interface.js";
import { sendNotificationEmail } from "./send-notification-email.js";
import { validatePayload } from "./validate-payload.js";
import { verifySecret } from "./verify-secret.js";

export const ProfileWebhookService: ProfileWebhookServiceInterface = {
  verifySecret,
  validatePayload,
  findMemberBySlug,
  sendNotificationEmail,
};

// Re-export for direct imports
export { findMemberBySlug } from "./find-member-by-slug.js";
export { sendNotificationEmail } from "./send-notification-email.js";
export type {
  MemberInfo,
  NotificationParameters,
  ValidationResult,
  WebhookPayload,
} from "./types.js";
export { validatePayload } from "./validate-payload.js";
export { verifySecret } from "./verify-secret.js";
