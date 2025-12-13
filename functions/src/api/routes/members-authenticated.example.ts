import type { RouteContext } from "../types/route-context.js";
import { HttpError } from "../errors/http-error.js";

/**
 * Example: Get member with authentication (NOT in production use).
 * Demonstrates authentication pattern where users can access their own data,
 * or admins can access any member.
 *
 * Dependencies injected via Elysia's decorate in app.ts:
 * - memberService: Service for member operations
 * - authService: Service for authentication/authorization
 * - logger: Logger for error tracking and audit logging
 *
 * Usage in app.ts:
 * ```typescript
 * app.get("/members/:memberId", (context) => getMemberAuthenticated(context));
 * ```
 */
export async function getMemberAuthenticated({
  params,
  memberService,
  authService,
  logger,
  request,
  set,
}: RouteContext<{ memberId: string }>) {
  const memberId = params.memberId;
  const authHeader = request.headers.get("authorization") ?? undefined;

  try {
    // Verify authentication and authorization using injected service
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authHeader,
      memberId,
    );

    // Audit log successful access
    logger.info("Authorized member access", {
      requestingUser: decodedToken.uid,
      targetMember: memberId,
      isAdmin: decodedToken["admin"] === true,
    });

    // Fetch member data using injected service
    return await memberService.findById(memberId);
  } catch (error) {
    // Handle our custom HTTP errors
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // Handle unexpected errors with authentication context
    logger.error("Failed to fetch member data", {
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      memberId,
      hasAuthHeader: !!authHeader,
    });
    set.status = 500;
    return { error: "Failed to retrieve member data" };
  }
}
