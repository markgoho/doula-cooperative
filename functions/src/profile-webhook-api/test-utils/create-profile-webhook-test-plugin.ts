import type { EmailServiceInterface } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import { mock } from "bun:test";
import { createProfileWebhookPlugin } from "../plugins/profile-webhook-plugin.js";
import type { ProfileWebhookService } from "../services/interface.js";
import {
  isProfileNotificationType,
  type MemberInfo,
  type ValidationResult,
  type WebhookPayload,
} from "../services/types.js";

/**
 * Creates the profile-webhook plugin with default mock services for testing.
 * Tests only the profile-webhook plugin in isolation - no full app composition needed.
 *
 * @param overrides - Partial method overrides for services
 * @returns Configured profile-webhook plugin with mocked services
 */
export function createProfileWebhookTestPlugin(overrides?: {
  profileWebhookService?: Partial<ProfileWebhookService>;
  emailService?: Partial<EmailServiceInterface>;
}) {
  const defaultProfileWebhookService: ProfileWebhookService = {
    verifySecret: mock(
      ({ provided, expected }: { provided: string; expected: string }) =>
        provided === expected,
    ),
    validatePayload: mock(
      ({ payload }: { payload: WebhookPayload }): ValidationResult => {
        if (!payload.notificationType || payload.slug === undefined) {
          return { isValid: false, reason: "invalid_payload" };
        }
        if (!payload.slug) {
          return { isValid: false, reason: "not_single_profile" };
        }
        if (!isProfileNotificationType(payload.notificationType)) {
          return { isValid: false, reason: "not_profile_related" };
        }
        return {
          isValid: true,
          payload: {
            notificationType: payload.notificationType,
            slug: payload.slug,
          },
        };
      },
    ),
    findMemberBySlug: mock(({ slug }: { slug: string }) =>
      Promise.resolve({
        uid: "member-123",
        email: "jane@example.com",
        name: "Jane Doe",
        slug,
      } satisfies MemberInfo),
    ),
    sendNotificationEmail: mock(() => Promise.resolve()),
    ...overrides?.profileWebhookService,
  };

  const defaultEmailService: EmailServiceInterface = {
    sendEmail: mock(() => Promise.resolve()),
    ...overrides?.emailService,
  };

  return createProfileWebhookPlugin({
    profileWebhookService: defaultProfileWebhookService,
    emailService: defaultEmailService,
  });
}
