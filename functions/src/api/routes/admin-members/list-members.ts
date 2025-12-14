import { ERROR_IDS } from "../../../constants/error-ids.js";
import type { Logger } from "../../handler.js";
import { handleRouteError } from "../../utils/route-error-handler.js";
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
    const { members, total } = await memberAdminService.listMembers({
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
      logger,
    });

    logger.info("Admin listed members", {
      adminUid,
      limit,
      offset,
      resultCount: members.length,
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
    return handleRouteError({
      error,
      operation: "list members",
      errorId: ERROR_IDS.API_ADMIN_LIST_MEMBERS_FAILED,
      logger,
      set,
      context: { limit, offset },
    });
  }
}
