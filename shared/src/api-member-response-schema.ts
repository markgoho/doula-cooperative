import { t, type Static } from "elysia";
import { SUBSCRIPTION_STATUSES } from "./subscription-status.js";
import { WELCOME_EMAIL_STATUSES } from "./welcome-email-status.js";

export const SubscriptionStatusSchema = t.Union(
  SUBSCRIPTION_STATUSES.map(status => t.Literal(status)),
);

export const WelcomeEmailStatusSchema = t.Union(
  WELCOME_EMAIL_STATUSES.map(status => t.Literal(status)),
);

export const MemberResponseSchema = t.Object({
  uid: t.String({
    description: "User ID (Firestore document ID)",
  }),
  email: t.String({
    format: "email",
    description: "User email address",
  }),
  createdAt: t.String({
    format: "date-time",
    description: "Account creation timestamp (ISO 8601)",
  }),
  isAdmin: t.Boolean({
    description: "Whether the user has admin privileges (from custom claims)",
  }),
  name: t.Optional(
    t.String({
      description: "User display name",
    }),
  ),
  subscriptionStart: t.Optional(
    t.String({
      format: "date-time",
      description: "Subscription start date (ISO 8601)",
    }),
  ),
  membershipActive: t.Optional(
    t.Boolean({
      description: "Whether the membership is currently active",
    }),
  ),
  membershipExpiresAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Membership expiration date (ISO 8601)",
    }),
  ),
  slug: t.Optional(
    t.String({
      description: "URL-friendly slug for the member's profile",
    }),
  ),
  profileCreatedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Profile creation timestamp (ISO 8601)",
    }),
  ),
  stripeCustomerId: t.Optional(
    t.String({
      description: "Stripe customer ID",
    }),
  ),
  stripeSubscriptionId: t.Optional(
    t.String({
      description: "Stripe subscription ID",
    }),
  ),
  subscriptionStatus: t.Optional(SubscriptionStatusSchema),
  lastPayment: t.Optional(
    t.String({
      format: "date-time",
      description: "Last payment date (ISO 8601)",
    }),
  ),
  nextPayment: t.Optional(
    t.String({
      format: "date-time",
      description: "Next payment date (ISO 8601)",
    }),
  ),
  welcomeEmailStatus: t.Optional(WelcomeEmailStatusSchema),
  welcomeEmailSentAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Welcome email sent timestamp (ISO 8601)",
    }),
  ),
  welcomeEmailError: t.Optional(
    t.String({
      description: "Error message if welcome email failed",
    }),
  ),
  newsletterSubscribed: t.Optional(
    t.Boolean({
      description: "Whether the user is subscribed to the newsletter",
    }),
  ),
  newsletterSubscribedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Newsletter subscription timestamp (ISO 8601)",
    }),
  ),
  newsletterUnsubscribedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Newsletter unsubscription timestamp (ISO 8601)",
    }),
  ),
  refundedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Refund timestamp (ISO 8601)",
    }),
  ),
  refundReason: t.Optional(
    t.String({
      description: "Reason for the membership refund",
    }),
  ),
});

export type ApiMemberResponse = Static<typeof MemberResponseSchema>;
