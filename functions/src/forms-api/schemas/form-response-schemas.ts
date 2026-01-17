import { t, type Static } from "elysia";

/**
 * Contact form request body schema.
 */
export const ContactFormBodySchema = t.Object({
  contactName: t.String({ minLength: 1, maxLength: 100 }),
  email: t.String({ format: "email", maxLength: 255 }),
  message: t.String({ minLength: 1, maxLength: 5000 }),
  recaptchaToken: t.Optional(t.String()),
});

export type ContactFormBody = Static<typeof ContactFormBodySchema>;

/**
 * Doula match form request body schema.
 */
export const DoulaMatchFormBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  phone: t.String({ minLength: 1, maxLength: 20 }),
  email: t.String({ format: "email", maxLength: 255 }),
  zipcode: t.String({ minLength: 5, maxLength: 10 }),
  estimatedDueDate: t.Object({
    month: t.String({ minLength: 1, maxLength: 2 }),
    day: t.String({ minLength: 1, maxLength: 2 }),
    year: t.String({ minLength: 4, maxLength: 4 }),
  }),
  services: t.Array(t.String()),
  birthLocation: t.String({ minLength: 1, maxLength: 500 }),
  otherInfo: t.String({ maxLength: 5000 }),
  insurance: t.Array(t.String()),
  recaptchaToken: t.Optional(t.String()),
});

export type DoulaMatchFormBody = Static<typeof DoulaMatchFormBodySchema>;

/**
 * Success response from form submission.
 */
export const FormSuccessSchema = t.Object({
  success: t.Literal(true, {
    description: "Indicates the form was submitted successfully",
  }),
  message: t.Optional(
    t.String({
      description: "Success message to display to the user",
    }),
  ),
  emailSent: t.Optional(
    t.Boolean({
      description: "Whether the notification email was sent successfully",
    }),
  ),
  warning: t.Optional(
    t.String({
      description: "Warning message for non-critical failures",
    }),
  ),
});

export type FormSuccessResponse = Static<typeof FormSuccessSchema>;

/**
 * Error response from form submission.
 */
export const FormErrorSchema = t.Object({
  success: t.Literal(false, {
    description: "Indicates the form submission failed",
  }),
  error: t.Optional(
    t.String({
      description: "Error message describing what went wrong",
    }),
  ),
});

export type FormErrorResponse = Static<typeof FormErrorSchema>;

/**
 * Union type for form responses.
 */
export const FormResponseSchema = t.Union([FormSuccessSchema, FormErrorSchema]);

export type FormResponse = Static<typeof FormResponseSchema>;
