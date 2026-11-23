/**
 * The first word of a requester's name, for the pre-Outreach view.
 * Never returns the rest of the name. Empty when no name was given.
 */
export function toFirstName(name: string): string {
  const [firstName = ""] = name.trim().split(/\s+/, 1);
  return firstName;
}
