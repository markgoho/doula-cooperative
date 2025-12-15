import { Elysia } from "elysia";
import type { DecodedIdToken } from "firebase-admin/auth";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { adminGuard } from "../../shared-api/utils/admin-guard.js";
import { getAdminUid } from "../../shared-api/utils/get-admin-uid.js";
import {
  getMessageLogic,
  listMessagesLogic,
  updateMessageLogic,
} from "../routes/index.js";
import {
  ListMessagesQuerySchema,
  MessageIdParameterSchema,
  UpdateMessageBodySchema,
} from "../schemas/message-schemas.js";
import { MessageAdminService } from "../services/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Auth result from derive - either a token or an error.
 * Index signature required for Elysia's derive return type.
 */
interface AuthResult {
  [key: string]: unknown;
  adminToken: DecodedIdToken | undefined;
  authError: HttpError | undefined;
}

/**
 * Create admin messages plugin with centralized authentication guard.
 * All routes in this plugin require admin privileges.
 *
 * Firebase rewrite: /api/admin/messages/** → adminMessagesApi function
 * Plugin routes start from "/" - Firebase already provides /api/admin/messages prefix
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with admin routes
 */
export function createAdminMessagesPlugin(services?: PartialServices) {
  return (
    new Elysia({ name: "admin-messages" })
      .decorate(
        SERVICE_KEYS.MESSAGE_ADMIN_SERVICE,
        services?.messageAdminService ?? MessageAdminService,
      )
      .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      .derive(async ({ request, authService, logger }): Promise<AuthResult> => {
        const authorizationHeader =
          request.headers.get("authorization") ?? undefined;
        try {
          const token = await authService.verifyAdmin(authorizationHeader);
          return { adminToken: token, authError: undefined };
        } catch (error) {
          if (error instanceof HttpError) {
            return { adminToken: undefined, authError: error };
          }

          logger.error("Unexpected error during admin authentication", {
            errorId: ERROR_IDS.API_AUTH_VERIFICATION_FAILED,
            error,
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            errorStack: error instanceof Error ? error.stack : undefined,
            errorType: error?.constructor?.name,
            hasAuthHeader: Boolean(authorizationHeader),
          });

          const infrastructureError = new HttpError(
            "Authentication service temporarily unavailable. Please try again.",
            503,
          );
          return {
            adminToken: undefined,
            authError: infrastructureError,
          };
        }
      })
      .onBeforeHandle({ as: "local" }, adminGuard)
      // GET / - List messages (served at /api/admin/messages/)
      .get(
        "/",
        async ({ query, adminToken, messageAdminService, logger, set }) =>
          listMessagesLogic({
            ...(query.limit !== undefined && { limit: query.limit }),
            ...(query.offset !== undefined && { offset: query.offset }),
            ...(query.status !== undefined && { status: query.status }),
            adminUid: getAdminUid(adminToken, logger),
            messageAdminService,
            logger,
            set,
          }),
        { query: ListMessagesQuerySchema },
      )
      // Message-specific routes under /:messageId
      .group("/:messageId", { params: MessageIdParameterSchema }, (app) =>
        app
          // GET /:messageId - Get single message
          .get(
            "/",
            async ({
              params,
              adminToken,
              messageAdminService,
              logger,
              set,
            }) =>
              getMessageLogic({
                messageId: params.messageId,
                adminUid: getAdminUid(adminToken, logger),
                messageAdminService,
                logger,
                set,
              }),
          )
          // PATCH /:messageId - Update message status
          .patch(
            "/",
            async ({
              params,
              body,
              adminToken,
              messageAdminService,
              logger,
              set,
            }) => {
              const typedBody = body as { sent: boolean };
              return updateMessageLogic({
                messageId: params.messageId,
                sent: typedBody.sent,
                adminUid: getAdminUid(adminToken, logger),
                messageAdminService,
                logger,
                set,
              });
            },
            { body: UpdateMessageBodySchema },
          ),
      )
  );
}
