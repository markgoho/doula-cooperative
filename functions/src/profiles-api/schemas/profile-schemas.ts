import { t, type Static } from "elysia";

/**
 * Contact information schema for profile data.
 */
export const ContactSchema = t.Object({
  phone: t.Optional(
    t.String({
      maxLength: 50,
      error: "Phone number must be 50 characters or less",
    }),
  ),
  email: t.Optional(
    t.String({
      format: "email",
      maxLength: 254,
      error: "Invalid email address",
    }),
  ),
  website: t.Optional(
    t.String({
      maxLength: 500,
      error: "Website URL must be 500 characters or less",
    }),
  ),
  business_name: t.Optional(
    t.String({
      maxLength: 200,
      error: "Business name must be 200 characters or less",
    }),
  ),
});

/**
 * Profile data schema for create/update operations.
 * Matches the ProfileData interface from types/profile-data.ts.
 */
export const ProfileDataBodySchema = t.Object({
  title: t.String({
    minLength: 1,
    maxLength: 200,
    error: "Title is required and must be 200 characters or less",
  }),
  bio: t.String({
    minLength: 1,
    maxLength: 10_000,
    error: "Bio is required and must be 10,000 characters or less",
  }),
  credentials: t.Optional(
    t.String({
      maxLength: 500,
      error: "Credentials must be 500 characters or less",
    }),
  ),
  pronouns: t.Optional(
    t.String({
      maxLength: 100,
      error: "Pronouns must be 100 characters or less",
    }),
  ),
  tags: t.Optional(
    t.Array(
      t.String({
        maxLength: 100,
        error: "Each tag must be 100 characters or less",
      }),
      {
        maxItems: 50,
        error: "Maximum 50 tags allowed",
      },
    ),
  ),
  contact: t.Optional(ContactSchema),
  draft: t.Optional(t.Boolean()),
});

/**
 * Type derived from ProfileDataBodySchema.
 * This is the request body type for create/update operations.
 */
export type ProfileDataBody = Static<typeof ProfileDataBodySchema>;

/**
 * ProfileData type for reading profiles (includes optional image field).
 * Source of truth is ProfileDataBodySchema - this extends it with response-only fields.
 */
export interface ProfileData extends ProfileDataBody {
  /** Optional: Profile image URL (managed separately from markdown content, provided by backend) */
  image?: string;
}

/**
 * Slug query parameter schema for checking availability.
 */
export const SlugQuerySchema = t.Object({
  slug: t.String({
    minLength: 2,
    maxLength: 100,
    pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
    error:
      "Slug must be 2-100 characters, lowercase letters, numbers, and hyphens only (e.g., jane-doe)",
  }),
});

/**
 * Slug body schema for setting user's slug.
 */
export const SetSlugBodySchema = t.Object({
  slug: t.String({
    minLength: 2,
    maxLength: 100,
    pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
    error:
      "Slug must be 2-100 characters, lowercase letters, numbers, and hyphens only (e.g., jane-doe)",
  }),
});

/**
 * Type derived from SlugQuerySchema.
 */
export type SlugQuery = Static<typeof SlugQuerySchema>;

/**
 * Type derived from SetSlugBodySchema.
 */
export type SetSlugBody = Static<typeof SetSlugBodySchema>;
