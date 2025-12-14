import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError } from "../../errors/http-error.js";
import type { Logger } from "../../handler.js";
import {
  toMemberResponse,
  type ListMembersResponse,
} from "../../schemas/member-schemas.js";
import type { MemberAdminService } from "../../services/service-interfaces.js";

/**
 * List all members with pagination logic (admin only).
 * Admin authentication is handled by the plugin guard.
 *
 * @returns Member list with pagination or error object
 */
export async function listMembersLogic({
  limit,
  offset,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  limit?: number;
  offset?: number;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ListMembersResponse | { error: string }> {
  try {
    // Audit log successful access
    logger.info("Admin listed members", {
      adminUid,
      limit,
      offset,
    });

    // Fetch member list
    const { members, total } = await memberAdminService.listMembers({
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
    });

    // Calculate pagination metadata
    const effectiveLimit = limit ?? 50;
    const effectiveOffset = offset ?? 0;
    const hasNext = effectiveOffset + members.length < total;

    return {
      members: members.map(member => toMemberResponse(member)),
      total,
      pagination: {
        limit: effectiveLimit,
        offset: effectiveOffset,
        hasNext,
      },
    };
  } catch (error) {
    // Handle our custom HTTP errors
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // Log unexpected errors with context
    const errorContext = {
      errorId: ERROR_IDS.API_ADMIN_LIST_MEMBERS_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      limit,
      offset,
    };

    logger.error("Failed to list members", errorContext);

    set.status = 500;
    return { error: "Failed to list members" };
  }
}
