import type { RouteContext } from "../types/route-context.js";
import type { MemberDocument } from "../../types/member-document.js";
import { HttpError } from "../errors/http-error.js";

/**
 * Get a member by ID (authenticated).
 * Requires authentication - users can access their own data, or admins can access any member.
 *
 * Dependencies injected via Elysia's decorate in app.ts:
 * - memberService: Service for member operations
 * - authService: Service for authentication/authorization
 * - logger: Logger for error tracking and audit logging
 *
 * @returns Member data or error object
 */
export async function getMember({
  params,
  memberService,
  authService,
  logger,
  request,
  set,
}: RouteContext<{ memberId: string }>): Promise<MemberDocument | { error: string }> {
  const memberId = params.memberId;
  const authorizationHeader = request.headers.get("authorization") ?? undefined;

  try {
    // Verify authentication and authorization using injected service
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
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

    // Log unexpected errors with context
    const errorContext = {
      memberId,
      hasAuthorizationHeader: !!authorizationHeader,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    };

    logger.error("Failed to fetch member data", errorContext);

    set.status = 500;
    return { error: "Failed to retrieve member data" };
  }
}
