import { lookup } from "zipcodes";

/**
 * Formats a ZIP code as a coarse "City, ST" area (e.g. "Rochester, NY").
 *
 * Accepts ZIP+4 input by looking up the first five digits. Never throws:
 * an unknown ZIP falls back to "ZIP <zipcode>".
 */
export function formatZipArea(zipcode: string): string {
  const trimmed = zipcode.trim();
  const info = lookup(trimmed.slice(0, 5));

  if (info === undefined) {
    return `ZIP ${trimmed}`;
  }

  return `${info.city}, ${info.state}`;
}
