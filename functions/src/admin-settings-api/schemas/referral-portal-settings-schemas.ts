import { t, type Static } from "elysia";

/**
 * Referral Portal v2 switch as returned to the admin app.
 */
export const ReferralPortalSettingsResponseSchema = t.Object({
  v2Enabled: t.Boolean(),
  updatedAt: t.Optional(t.String({ format: "date-time" })),
  updatedBy: t.Optional(t.String({ description: "UID of the Admin" })),
});

export type ReferralPortalSettingsResponse = Static<
  typeof ReferralPortalSettingsResponseSchema
>;

/**
 * PATCH /referral-portal body
 */
export const UpdateReferralPortalSettingsBodySchema = t.Object({
  v2Enabled: t.Boolean(),
});
