import type { RouteContext } from "../types/route-context.js";
import { HttpError } from "../errors/http-error.js";
import { logger } from "firebase-functions/v2";

/**
 * Example: Get member with authentication.
 * User can access their own data, or admins can access any member.
 *
 * Dependencies injected via Elysia's decorate in app.ts:
 * - memberService: Service for member operations
 * - authService: Service for authentication/authorization
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

    // Handle unexpected errors
    logger.error("Failed to fetch member data", {
      error,
      memberId,
    });
    set.status = 500;
    return { error: "Failed to retrieve member data" };
  }
}
