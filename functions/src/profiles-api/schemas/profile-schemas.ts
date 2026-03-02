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

export type Contact = Static<typeof ContactSchema>;

/**
 * Profile data schema for create/update operations.
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

/**
 * Slug path parameter schema for reading profiles by slug.
 */
export const SlugParameterSchema = t.Object({
  slug: t.String({
    minLength: 2,
    maxLength: 100,
    pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
    error:
      "Slug must be 2-100 characters, lowercase letters, numbers, and hyphens only (e.g., jane-doe)",
  }),
});

/**
 * Type derived from SlugParameterSchema.
 */
export type SlugParameter = Static<typeof SlugParameterSchema>;

/**
 * Upload profile image request schema.
 */
export const UploadProfileImageBodySchema = t.Object({
  imageData: t.String({
    minLength: 1,
    error: "Image data is required",
  }),
  mimeType: t.String({
    pattern: "^image/(jpeg|png|webp)$",
    error:
      "Invalid image type. Allowed types: image/jpeg, image/png, image/webp",
  }),
});

/**
 * Type derived from UploadProfileImageBodySchema.
 */
export type UploadProfileImageBody = Static<
  typeof UploadProfileImageBodySchema
>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Error response schema (used across all routes).
 */
const ErrorResponseSchema = t.Object({
  error: t.String(),
});

/**
 * Success response for reading a profile by slug.
 * GET /api/profiles/:slug
 */
const ReadProfileSuccessSchema = t.Object({
  title: t.String(),
  bio: t.String(),
  credentials: t.Optional(t.String()),
  pronouns: t.Optional(t.String()),
  tags: t.Optional(t.Array(t.String())),
  contact: t.Optional(ContactSchema),
  draft: t.Optional(t.Boolean()),
  image: t.Optional(t.String()),
});

export type ReadProfileSuccessResponse = Static<
  typeof ReadProfileSuccessSchema
>;

export const ReadProfileResponseSchema = t.Union([
  ReadProfileSuccessSchema,
  ErrorResponseSchema,
]);

export type ReadProfileResponse = Static<typeof ReadProfileResponseSchema>;

/**
 * Success response for checking slug availability.
 * GET /api/profiles/slugs/check?slug=jane-doe
 */
const CheckSlugAvailableSuccessSchema = t.Object({
  available: t.Boolean(),
});

export type CheckSlugAvailableSuccessResponse = Static<
  typeof CheckSlugAvailableSuccessSchema
>;

export const CheckSlugAvailableResponseSchema = t.Union([
  CheckSlugAvailableSuccessSchema,
  ErrorResponseSchema,
]);

export type CheckSlugAvailableResponse = Static<
  typeof CheckSlugAvailableResponseSchema
>;

/**
 * Success response for setting profile slug.
 * POST /api/profiles/slugs
 */
const SetSlugSuccessSchema = t.Object({
  slug: t.String(),
});

export type SetSlugSuccessResponse = Static<typeof SetSlugSuccessSchema>;

export const SetSlugResponseSchema = t.Union([
  SetSlugSuccessSchema,
  ErrorResponseSchema,
]);

export type SetSlugResponse = Static<typeof SetSlugResponseSchema>;

/**
 * Success response for updating profile.
 * PUT /api/profiles/:slug
 */
const WriteProfileSuccessSchema = t.Object({
  success: t.Literal(true),
  profile: t.Optional(ProfileDataBodySchema),
});

export type WriteProfileSuccessResponse = Static<
  typeof WriteProfileSuccessSchema
>;

export const WriteProfileResponseSchema = t.Union([
  WriteProfileSuccessSchema,
  ErrorResponseSchema,
]);

export type WriteProfileResponse = Static<typeof WriteProfileResponseSchema>;

/**
 * Success response for creating profile.
 * POST /api/profiles/:slug
 */
const CreateProfileSuccessSchema = t.Object({
  success: t.Literal(true),
  profile: t.Optional(ProfileDataBodySchema),
});

export type CreateProfileSuccessResponse = Static<
  typeof CreateProfileSuccessSchema
>;

export const CreateProfileResponseSchema = t.Union([
  CreateProfileSuccessSchema,
  ErrorResponseSchema,
]);

export type CreateProfileResponse = Static<typeof CreateProfileResponseSchema>;

/**
 * Success response for claiming unclaimed profile.
 * POST /api/profiles/:slug/claim
 */
const ClaimProfileSuccessSchema = t.Union([
  t.Object({
    status: t.Literal("success"),
    data: t.Object({
      email: t.String({ format: "email" }),
      name: t.String(),
      slug: t.Optional(t.String()),
      subscriptionStart: t.Any(), // Timestamp - not JSON serializable
      lastPayment: t.Any(), // Timestamp
      nextPayment: t.Any(), // Timestamp
      createdAt: t.Optional(t.Any()), // Timestamp
      updatedAt: t.Optional(t.Any()), // Timestamp
    }),
  }),
  t.Object({
    status: t.Literal("no_profile_to_claim"),
  }),
]);

export type ClaimProfileSuccessResponse = Static<
  typeof ClaimProfileSuccessSchema
>;

export const ClaimProfileResponseSchema = t.Union([
  ClaimProfileSuccessSchema,
  ErrorResponseSchema,
]);

export type ClaimProfileResponse = Static<typeof ClaimProfileResponseSchema>;

/**
 * Success response for uploading profile image.
 * POST /api/profiles/:slug/image
 */
const UploadImageSuccessSchema = t.Object({
  success: t.Literal(true),
  url: t.String(),
});

export type UploadImageSuccessResponse = Static<
  typeof UploadImageSuccessSchema
>;

export const UploadImageResponseSchema = t.Union([
  UploadImageSuccessSchema,
  ErrorResponseSchema,
]);

export type UploadImageResponse = Static<typeof UploadImageResponseSchema>;

/**
 * Success response for deleting profile image.
 * DELETE /api/profiles/:slug/image
 */
const DeleteImageSuccessSchema = t.Object({
  success: t.Literal(true),
});

export type DeleteImageSuccessResponse = Static<
  typeof DeleteImageSuccessSchema
>;

export const DeleteImageResponseSchema = t.Union([
  DeleteImageSuccessSchema,
  ErrorResponseSchema,
]);

export type DeleteImageResponse = Static<typeof DeleteImageResponseSchema>;

/**
 * Success response for ImageKit auth endpoint.
 * GET /api/profiles/auth
 */
const ImageKitAuthSuccessSchema = t.Object({
  token: t.String(),
  expire: t.Number(),
  signature: t.String(),
});

export type ImageKitAuthSuccessResponse = Static<
  typeof ImageKitAuthSuccessSchema
>;

export const ImageKitAuthResponseSchema = t.Union([
  ImageKitAuthSuccessSchema,
  ErrorResponseSchema,
]);

export type ImageKitAuthResponse = Static<typeof ImageKitAuthResponseSchema>;
