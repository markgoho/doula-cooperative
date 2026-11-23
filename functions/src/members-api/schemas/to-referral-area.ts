import { formatZipArea } from "../../shared-api/utils/format-zip-area.js";

/**
 * A Referral's coarse "City, ST" area from its ZIP code.
 * Empty when no ZIP code was given.
 */
export function toReferralArea(zipcode: string): string {
  if (zipcode.trim() === "") return "";
  return formatZipArea(zipcode);
}
