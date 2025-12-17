/**
 * Generate a secure random password for new users.
 * Uses crypto.getRandomValues for cryptographically secure randomness.
 */
export function generateSecurePassword(): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const length = 20;
  let password = "";

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  for (const number of array) {
    password += characters.charAt(number % characters.length);
  }

  return password;
}
