import type { ErrorId } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { MemberDocument } from "../../types/member-document.js";
import {
  toMemberResponse,
  type MemberSuccessResponse,
} from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Configuration for the generic member admin route handler factory.
 * Allows customization of operation name, error ID, logging, and context.
 */
export interface RouteHandlerConfig<TParameters> {
  /**
  Human-readable operation name (e.g., "activate membership")
  */
  operation: string;

  /**
  Error ID constant from ERROR_IDS for this operation
  */
  errorId: ErrorId;

  /**
  Service method to call (receives memberId and parsed parameters)
  */
  serviceMethod: (
    service: MemberAdminService,
    memberId: string,
    parameters: TParameters,
  ) => Promise<MemberDocument>;

  /**
  Parse and validate route-specific parameters
  */
  parseParameters: (parameters: TParameters) => TParameters;

  /**
  Generate log context object for successful operations
  */
  getLogContext: (
    memberId: string,
    adminUid: string,
    result: MemberDocument,
    parameters: TParameters,
  ) => Record<string, unknown>;

  /**
  Generate error context object for failed operations
  */
  getErrorContext: (
    memberId: string,
    parameters: TParameters,
  ) => Record<string, unknown>;
}

/**
 * Generic route handler factory for member admin operations.
 * Reduces duplication by extracting the common try/catch/log/transform pattern.
 *
 * All route handlers follow this structure:
 * 1. Call service method with validated parameters
 * 2. Log successful operation with context
 * 3. Check admin status
 * 4. Transform document to response
 * 5. Handle errors with standardized error reporting
 *
 * @param config - Configuration object defining operation behavior
 * @returns Route handler function
 */
export function createMemberRouteHandler<
  TParameters extends Record<string, unknown>,
>(config: RouteHandlerConfig<TParameters>) {
  return async (
    routeArguments: {
      memberId: string;
      adminUid: string;
      memberAdminService: MemberAdminService;
      logger: Logger;
      set: { status?: number | string };
    } & TParameters,
  ): Promise<MemberSuccessResponse | { error: string }> => {
    const {
      memberId,
      adminUid,
      memberAdminService,
      logger,
      set,
      ...parameters
    } = routeArguments;

    try {
      const validatedParameters = config.parseParameters(
        parameters as unknown as TParameters,
      );

      const member = await config.serviceMethod(
        memberAdminService,
        memberId,
        validatedParameters,
      );

      logger.info(`Admin ${config.operation}`, {
        ...config.getLogContext(
          memberId,
          adminUid,
          member,
          validatedParameters,
        ),
      });

      const isAdmin = await memberAdminService.isAdmin(memberId, logger);
      return { success: true, member: toMemberResponse(member, isAdmin) };
    } catch (error) {
      return handleRouteError({
        error,
        operation: config.operation,
        errorId: config.errorId,
        logger,
        set,
        context: config.getErrorContext(
          memberId,
          parameters as unknown as TParameters,
        ),
      });
    }
  };
}
