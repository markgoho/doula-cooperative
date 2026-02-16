import { Elysia } from "elysia";
import type { DecodedIdToken } from "firebase-admin/auth";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { ForbiddenError } from "../../shared-api/errors/http-error.js";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { EmailService } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { getUserUid } from "../../shared-api/utils/get-user-uid.js";
import { userDerive } from "../../shared-api/utils/user-derive.js";
import { userGuard } from "../../shared-api/utils/user-guard.js";
import {
  checkSlugAvailableLogic,
  claimProfileLogic,
  createProfileLogic,
  deleteImageLogic,
  imagekitAuthLogic,
  readProfileBySlugLogic,
  setSlugLogic,
  uploadImageLogic,
  writeProfileLogic,
} from "../routes/index.js";
import {
  CheckSlugAvailableResponseSchema,
  ClaimProfileResponseSchema,
  CreateProfileResponseSchema,
  DeleteImageResponseSchema,
  ImageKitAuthResponseSchema,
  ProfileDataBodySchema,
  ReadProfileResponseSchema,
  SetSlugBodySchema,
  SetSlugResponseSchema,
  SlugParameterSchema,
  SlugQuerySchema,
  UploadImageResponseSchema,
  UploadProfileImageBodySchema,
  WriteProfileResponseSchema,
} from "../schemas/profile-schemas.js";
import { AuthUpdateService } from "../services/auth-update/index.js";
import { ClaimProfileFirestoreService } from "../services/firestore/index.js";
import { ProfileGitHubService } from "../services/github/index.js";
import { ProfileMemberService } from "../services/member/index.js";
import type { ProfileMemberService as ProfileMemberServiceType } from "../services/member/interface.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Validates that the authenticated user owns the slug OR is an admin.
 * Throws ForbiddenError if validation fails.
 *
 * @param urlSlug - The slug from the URL parameters
 * @param userToken - The decoded Firebase auth token
 * @param profileMemberService - Service to fetch member data
 * @param logger - Logger instance
 */
async function validateSlugOwnershipOrAdmin({
  urlSlug,
  userToken,
  profileMemberService,
  logger,
}: {
  urlSlug: string;
  userToken: DecodedIdToken | undefined;
  profileMemberService: ProfileMemberServiceType;
  logger: Logger;
}): Promise<void> {
  if (!userToken) {
    throw new ForbiddenError("Authentication required");
  }

  const uid = getUserUid(userToken, logger);

  // Check if user is admin
  const isAdmin = userToken["admin"] === true;
  if (isAdmin) {
    logger.info("Admin accessing profile", { uid, urlSlug });
    return; // Admins can access any profile
  }

  // Get the authenticated user's member document to check their slug
  const member = await profileMemberService.getMemberByUid(uid);

  if (member.slug !== urlSlug) {
    logger.warn("User attempted to access profile they don't own", {
      uid,
      userSlug: member.slug,
      requestedSlug: urlSlug,
    });
    throw new ForbiddenError("You can only modify your own profile");
  }
}

/**
 * Create profiles plugin with both public and authenticated routes.
 *
 * Firebase rewrite: /api/profiles/** → profilesApi function
 * Plugin routes start from "/" - Firebase already provides /api/profiles prefix
 *
 * Public routes:
 * - /:slug (GET)           - Read any profile by slug (no auth required)
 * - /slugs/check (GET)     - Check if slug is available
 *
 * Authenticated routes (must own the slug OR be admin):
 * - /:slug (PUT)           - Update profile
 * - /:slug (POST)          - Create profile
 * - /:slug/claim (POST)    - Claim unclaimed profile
 * - /:slug/image (POST)    - Upload profile image
 * - /:slug/image (DELETE)  - Delete profile image
 *
 * Special routes:
 * - /slugs (POST)          - Set profile slug (for users without a slug yet)
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with profile routes
 */
export function createProfilesPlugin(services?: PartialServices) {
  return (
    new Elysia({ name: "profiles" })
      .decorate(
        SERVICE_KEYS.PROFILE_GITHUB_SERVICE,
        services?.profileGitHubService ?? ProfileGitHubService,
      )
      .decorate(
        SERVICE_KEYS.PROFILE_MEMBER_SERVICE,
        services?.profileMemberService ?? ProfileMemberService,
      )
      .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
      .decorate(
        SERVICE_KEYS.EMAIL_SERVICE,
        services?.emailService ?? EmailService,
      )
      .decorate(
        SERVICE_KEYS.CLAIM_PROFILE_FIRESTORE_SERVICE,
        services?.claimProfileFirestoreService ?? ClaimProfileFirestoreService,
      )
      .decorate(
        SERVICE_KEYS.AUTH_UPDATE_SERVICE,
        services?.authUpdateService ?? AuthUpdateService,
      )
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // PUBLIC ROUTES (before auth guards)

      // GET /:slug - Read profile by slug (no auth)
      .get(
        "/:slug",
        async ({ params, profileGitHubService, logger, set }) =>
          readProfileBySlugLogic({
            slug: params.slug,
            profileGitHubService,
            logger,
            set,
          }),
        {
          params: SlugParameterSchema,
          response: ReadProfileResponseSchema,
        },
      )
      // GET /slugs/check - Check if slug is available (no auth)
      .get(
        "/slugs/check",
        async ({ query, profileMemberService, logger, set }) =>
          checkSlugAvailableLogic({
            slug: query.slug,
            profileMemberService,
            logger,
            set,
          }),
        {
          query: SlugQuerySchema,
          response: CheckSlugAvailableResponseSchema,
        },
      )

      // AUTHENTICATED ROUTES (after auth guards)
      .derive(userDerive)
      .onBeforeHandle({ as: "local" }, userGuard)

      // POST /slugs - Set profile slug (for users without a slug yet)
      .post(
        "/slugs",
        async ({ body, userToken, profileMemberService, logger, set }) =>
          setSlugLogic({
            uid: getUserUid(userToken, logger),
            slug: body.slug,
            profileMemberService,
            logger,
            set,
          }),
        {
          body: SetSlugBodySchema,
          response: SetSlugResponseSchema,
        },
      )

      // PUT /:slug - Update profile (must own slug or be admin)
      .put(
        "/:slug",
        async ({
          params,
          body,
          userToken,
          profileGitHubService,
          profileMemberService,
          logger,
          set,
        }) => {
          await validateSlugOwnershipOrAdmin({
            urlSlug: params.slug,
            userToken,
            profileMemberService,
            logger,
          });

          return writeProfileLogic({
            uid: getUserUid(userToken, logger),
            data: body,
            profileGitHubService,
            profileMemberService,
            logger,
            set,
          });
        },
        {
          params: SlugParameterSchema,
          body: ProfileDataBodySchema,
          response: WriteProfileResponseSchema,
        },
      )

      // POST /:slug - Create profile (must own slug or be admin)
      .post(
        "/:slug",
        async ({
          params,
          body,
          userToken,
          profileGitHubService,
          profileMemberService,
          emailService,
          logger,
          set,
        }) => {
          await validateSlugOwnershipOrAdmin({
            urlSlug: params.slug,
            userToken,
            profileMemberService,
            logger,
          });

          return createProfileLogic({
            uid: getUserUid(userToken, logger),
            data: body,
            profileGitHubService,
            profileMemberService,
            emailService,
            logger,
            set,
          });
        },
        {
          params: SlugParameterSchema,
          body: ProfileDataBodySchema,
          response: CreateProfileResponseSchema,
        },
      )
      // POST /:slug/claim - Claim unclaimed profile (must own slug or be admin)
      .post(
        "/:slug/claim",
        async ({
          params,
          userToken,
          profileMemberService,
          emailService,
          claimProfileFirestoreService,
          authUpdateService,
          logger,
          set,
        }) => {
          await validateSlugOwnershipOrAdmin({
            urlSlug: params.slug,
            userToken,
            profileMemberService,
            logger,
          });

          if (!userToken) {
            set.status = 401;
            return { error: "Authentication required" };
          }

          const uid = getUserUid(userToken, logger);
          const email = userToken.email;
          const emailVerified = userToken.email_verified ?? false;

          if (!email) {
            set.status = 400;
            return {
              error: "Authentication token did not contain an email address.",
            };
          }

          return claimProfileLogic({
            uid,
            email,
            emailVerified,
            emailService,
            claimProfileFirestoreService,
            authUpdateService,
            logger,
            set,
          });
        },
        {
          params: SlugParameterSchema,
          response: ClaimProfileResponseSchema,
        },
      )

      // POST /:slug/image - Upload profile image (must own slug or be admin)
      .post(
        "/:slug/image",
        async ({
          params,
          body,
          userToken,
          profileMemberService,
          logger,
          set,
        }) => {
          await validateSlugOwnershipOrAdmin({
            urlSlug: params.slug,
            userToken,
            profileMemberService,
            logger,
          });

          return uploadImageLogic({
            uid: getUserUid(userToken, logger),
            imageData: body.imageData,
            profileMemberService,
            logger,
            set,
          });
        },
        {
          params: SlugParameterSchema,
          body: UploadProfileImageBodySchema,
          response: UploadImageResponseSchema,
        },
      )

      // DELETE /:slug/image - Delete profile image (must own slug or be admin)
      .delete(
        "/:slug/image",
        async ({ params, userToken, profileMemberService, logger, set }) => {
          await validateSlugOwnershipOrAdmin({
            urlSlug: params.slug,
            userToken,
            profileMemberService,
            logger,
          });

          return deleteImageLogic({
            uid: getUserUid(userToken, logger),
            profileMemberService,
            logger,
            set,
          });
        },
        {
          params: SlugParameterSchema,
          response: DeleteImageResponseSchema,
        },
      )

      // GET /auth - Get ImageKit auth parameters (authenticated)
      .get(
        "/auth",
        ({ userToken, profileMemberService, logger, set }) =>
          imagekitAuthLogic({
            uid: getUserUid(userToken, logger),
            profileMemberService,
            logger,
            set,
          }),
        {
          response: ImageKitAuthResponseSchema,
        },
      )
  );
}
