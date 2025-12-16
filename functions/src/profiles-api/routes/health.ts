/**
 * Health check route for profiles-api.
 * Returns simple status object for monitoring.
 */
export function healthRoute(): { status: string } {
  return { status: "ok" };
}
