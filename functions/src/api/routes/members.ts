import type { RouteContext } from "../types/route-context.js";
import { HttpError } from "../errors/http-error.js";

/**
 * Get a member by ID.
 *
 * Dependencies injected via Elysia's decorate in app.ts:
 * - memberService: Service for member operations
 * - logger: Logger for error tracking
 *
 * @returns Member data or error object
 */
export async function getMember({
  params,
  memberService,
  logger,
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

    // Handle unexpected errors with comprehensive logging
    logger.error("Unexpected error in getMember route", {
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId: params.memberId,
    });

    set.status = 500;
    return { error: "Internal server error" };
  }
}
