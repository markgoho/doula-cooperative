import { Timestamp } from "firebase-admin/firestore";
import { ValidationError } from "../errors/http-error.js";

/**
 * Validate and convert an ISO 8601 date string to a Firestore Timestamp.
 *
 * @param dateString - ISO 8601 date string (e.g., "2025-12-31T00:00:00Z")
 * @param fieldName - Name of the field (for error messages)
 * @returns Firestore Timestamp
 * @throws ValidationError if date format is invalid or out of reasonable range
 */
export function validateAndConvertDate(
  dateString: string,
  fieldName: string,
): Timestamp {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(
      `Invalid date format for ${fieldName}. Expected ISO 8601 format (e.g., "2025-12-31T00:00:00Z")`,
    );
  }

  const year = date.getFullYear();
  if (year < 2020 || year > 2100) {
    throw new ValidationError(
      `${fieldName} must be between 2020 and 2100. Got: ${year}`,
    );
  }

  return Timestamp.fromDate(date);
}

/**
 * Validate that a start date is before an end date.
 *
 * @param startDate - Start date string
 * @param endDate - End date string
 * @param startFieldName - Name of start field (for error messages)
 * @param endFieldName - Name of end field (for error messages)
 * @throws ValidationError if end date is before or equal to start date
 */
export function validateDateOrder(
  startDate: string,
  endDate: string,
  startFieldName: string,
  endFieldName: string,
): void {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    throw new ValidationError(
      `${endFieldName} must be after ${startFieldName}. Got start: ${startDate}, end: ${endDate}`,
    );
  }
}

/**
 * Validate membership dates for consistency.
 * Ensures that if both dates are provided, subscriptionStart is before membershipExpiresAt.
 *
 * @param subscriptionStart - Optional subscription start date
 * @param membershipExpiresAt - Optional membership expiration date
 * @throws ValidationError if dates are provided but in wrong order
 */
export function validateMembershipDates(
  subscriptionStart?: string,
  membershipExpiresAt?: string,
): void {
  if (subscriptionStart && membershipExpiresAt) {
    validateDateOrder(
      subscriptionStart,
      membershipExpiresAt,
      "subscriptionStart",
      "membershipExpiresAt",
    );
  }
}
