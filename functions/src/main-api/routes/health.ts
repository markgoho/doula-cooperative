/**
 * Health check route for main-api.
 * Returns a simple status object to verify the API is running.
 */
export function healthRoute(): { status: string; api: string } {
  return { status: "ok", api: "main-api" };
}
