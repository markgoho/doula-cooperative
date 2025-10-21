import { HttpsError } from "firebase-functions/https";
import { type ProfileData } from "../types/profile-data";

/**
 * Validates ProfileData input to ensure data integrity and security.
 * Throws HttpsError with specific validation messages.
 */
export function validateProfileData(data: ProfileData): void {
  // Validate required fields
  if (!data.title || typeof data.title !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Title is required and must be a string.",
    );
  }

  if (data.title.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Title cannot be empty.");
  }

  if (data.title.length > 200) {
    throw new HttpsError(
      "invalid-argument",
      "Title must be 200 characters or less.",
    );
  }

  if (!data.bio || typeof data.bio !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Bio is required and must be a string.",
    );
  }

  if (data.bio.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Bio cannot be empty.");
  }

  if (data.bio.length > 10_000) {
    throw new HttpsError(
      "invalid-argument",
      "Bio must be 10,000 characters or less.",
    );
  }

  // Validate optional credentials field
  if (data.credentials !== undefined) {
    if (typeof data.credentials !== "string") {
      throw new HttpsError("invalid-argument", "Credentials must be a string.");
    }
    if (data.credentials.length > 500) {
      throw new HttpsError(
        "invalid-argument",
        "Credentials must be 500 characters or less.",
      );
    }
  }

  // Validate optional tags array
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      throw new HttpsError("invalid-argument", "Tags must be an array.");
    }
    if (data.tags.length > 50) {
      throw new HttpsError(
        "invalid-argument",
        "Cannot have more than 50 tags.",
      );
    }
    for (const tag of data.tags) {
      if (typeof tag !== "string") {
        throw new HttpsError("invalid-argument", "All tags must be strings.");
      }
      if (tag.length > 100) {
        throw new HttpsError(
          "invalid-argument",
          "Each tag must be 100 characters or less.",
        );
      }
    }
  }

  // Validate optional contact object
  if (data.contact !== undefined) {
    if (typeof data.contact !== "object" || Array.isArray(data.contact)) {
      throw new HttpsError("invalid-argument", "Contact must be an object.");
    }

    // Validate phone number
    if (data.contact.phone !== undefined) {
      if (typeof data.contact.phone !== "string") {
        throw new HttpsError("invalid-argument", "Phone must be a string.");
      }
      if (data.contact.phone.length > 50) {
        throw new HttpsError(
          "invalid-argument",
          "Phone must be 50 characters or less.",
        );
      }
    }

    // Validate email address
    if (data.contact.email !== undefined) {
      if (typeof data.contact.email !== "string") {
        throw new HttpsError("invalid-argument", "Email must be a string.");
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.contact.email)) {
        throw new HttpsError(
          "invalid-argument",
          "Email must be a valid email address.",
        );
      }
      if (data.contact.email.length > 254) {
        throw new HttpsError(
          "invalid-argument",
          "Email must be 254 characters or less.",
        );
      }
    }

    // Validate website URL
    if (data.contact.website !== undefined) {
      if (typeof data.contact.website !== "string") {
        throw new HttpsError("invalid-argument", "Website must be a string.");
      }
      if (data.contact.website.trim().length > 0) {
        // Basic URL validation - accept with or without protocol
        const urlRegex =
          /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
        if (!urlRegex.test(data.contact.website)) {
          throw new HttpsError(
            "invalid-argument",
            "Website must be a valid URL.",
          );
        }
        if (data.contact.website.length > 500) {
          throw new HttpsError(
            "invalid-argument",
            "Website URL must be 500 characters or less.",
          );
        }
      }
    }

    // Validate business name
    if (data.contact.business_name !== undefined) {
      if (typeof data.contact.business_name !== "string") {
        throw new HttpsError(
          "invalid-argument",
          "Business name must be a string.",
        );
      }
      if (data.contact.business_name.length > 200) {
        throw new HttpsError(
          "invalid-argument",
          "Business name must be 200 characters or less.",
        );
      }
    }
  }
}
