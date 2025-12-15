import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import {
  toMemberResponse,
  type ListMembersResponse,
} from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * List all members (admin only).
 * Admin authentication is handled by the plugin guard.
 *
 * @returns Member list or error object
 */
export async function listMembersLogic({
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ListMembersResponse | { error: string }> {
  try {
    const result = await memberAdminService.listMembers({ logger });

    const logContext: Record<string, unknown> = {
      adminUid,
      resultCount: result.members.length,
    };
    if (result.warning !== undefined) {
      logContext["warning"] = result.warning;
    }
    logger.info("Admin listed members", logContext);

    const response: ListMembersResponse = {
      members: result.members.map(member => toMemberResponse(member)),
      total: result.total,
    };

    if (result.warning !== undefined) {
      (response as { warning?: string }).warning = result.warning;
    }

    return response;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "list members",
      errorId: ERROR_IDS.API_ADMIN_LIST_MEMBERS_FAILED,
      logger,
      set,
    });
  }
}
