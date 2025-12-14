/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * @param provided - The secret provided in the webhook request
 * @param expected - The expected secret from environment
 * @returns true if secrets match, false otherwise
 */
export function verifySecret({
  provided,
  expected,
}: {
  provided: string;
  expected: string;
}): boolean {
  if (provided.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < provided.length; index++) {
    const providedCode = provided.codePointAt(index) ?? 0;
    const expectedCode = expected.codePointAt(index) ?? 0;
    result |= providedCode ^ expectedCode;
  }
  return result === 0;
}
