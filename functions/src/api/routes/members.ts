import type { RouteContext } from "../types/route-context.js";
import { HttpError } from "../errors/http-error.js";

/**
 * Get a member by ID.
 *
 * Dependencies injected via Elysia's decorate in app.ts:
 * - memberService: Service for member operations
 *
 * @returns Member data or error object
 */
export async function getMember({
  params,
  memberService,
  set,
}: RouteContext<{ memberId: string }>) {
  try {
    return await memberService.findById(params.memberId);
  } catch (error) {
    // Handle our custom HTTP errors
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // Handle unexpected errors
    set.status = 500;
    return { error: "Internal server error" };
  }
}
