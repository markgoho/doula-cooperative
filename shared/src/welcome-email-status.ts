export const WELCOME_EMAIL_STATUSES = ["sent", "failed", "pending"] as const;

export type WelcomeEmailStatus = (typeof WELCOME_EMAIL_STATUSES)[number];
