/**
 * Check if code is running in Firebase emulator environment.
 *
 * This is useful for skipping operations that should not run in local development,
 * such as sending actual emails, making real API calls, or charging credit cards.
 *
 * @returns True if running in emulator environment, false otherwise
 */
export function isEmulator(): boolean {
  return process.env["FUNCTIONS_EMULATOR"] === "true";
}
