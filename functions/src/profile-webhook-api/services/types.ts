export type ProfileNotificationType =
  | "publish"
  | "update"
  | "image-update"
  | "image-delete";

export interface WebhookPayload {
  notificationType?: string;
  slug?: string;
  secret?: string;
}

export interface ValidatedWebhookPayload {
  notificationType: ProfileNotificationType;
  slug: string;
}

export interface MemberInfo {
  uid: string;
  email: string;
  name: string | undefined;
  slug: string;
}

export interface NotificationParameters {
  memberEmail: string;
  memberName: string | undefined;
  slug: string;
  notificationType: ProfileNotificationType;
}

export type ValidationFailureReason =
  | "invalid_payload"
  | "not_single_profile"
  | "not_profile_related";

export type ValidationResult =
  | {
      isValid: false;
      reason: ValidationFailureReason;
    }
  | {
      isValid: true;
      payload: ValidatedWebhookPayload;
    };

export const PROFILE_NOTIFICATION_TYPES: readonly ProfileNotificationType[] = [
  "publish",
  "update",
  "image-update",
  "image-delete",
] as const;

export function isProfileNotificationType(
  value: string,
): value is ProfileNotificationType {
  return PROFILE_NOTIFICATION_TYPES.includes(value as ProfileNotificationType);
}
