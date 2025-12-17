export interface WebhookPayload {
  commitMessage: string;
  commitSha: string;
  slug: string; // Empty string if not single profile update
  secret: string;
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
  commitMessage: string;
}

export interface ValidationResult {
  isValid: boolean;
  reason: string | undefined;
}
