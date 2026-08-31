import { Elysia } from "elysia";
import type { DecodedIdToken } from "firebase-admin/auth";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { ForbiddenError } from "../../shared-api/errors/http-error.js";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { EmailService } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { getUserUid } from "../../shared-api/utils/get-user-uid.js";
import { optionalUserDerive } from "../../shared-api/utils/optional-user-derive.js";
import { userDerive } from "../../shared-api/utils/user-derive.js";
import { userGuard } from "../../shared-api/utils/user-guard.js";
import {
  checkSlugAvailableLogic,
  claimProfileLogic,
  createProfileLogic,
  deleteImageLogic,
  imagekitAuthLogic,
  readProfileBySlugLogic,
  requestProfileLinkLogic,
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
  RequestProfileLinkResponseSchema,
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
import { ProfileMemberService } from "../services/member/index.js";
import type { ProfileMemberService as ProfileMemberServiceType } from "../services/member/interface.js";
import { ProfileStoreService } from "../services/profile-store/index.js";
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
 * - /slugs/link-request (POST) - Ask an admin to link an existing unowned profile
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with profile routes
 */
export function createProfilesPlugin(services?: PartialServices) {
  return (
    new Elysia({ name: "profiles" })
      .decorate(
        SERVICE_KEYS.PROFILE_STORE_SERVICE,
        services?.profileStoreService ?? ProfileStoreService,
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

      // Optional auth for all routes — gives userToken (may be undefined) to public routes
      .derive(optionalUserDerive)

      // PUBLIC ROUTES (before auth guards)

      // GET /:slug - Read profile by slug (optional auth for draft access control)
      .get(
        "/:slug",
        async ({ params, profileStoreService, userToken, logger, set }) =>
          readProfileBySlugLogic({
            slug: params.slug,
            profileStoreService,
            userToken,
            logger,
            set,
          }),
        {
          params: SlugParameterSchema,
          response: ReadProfileResponseSchema,
        },
      )
      // GET /slugs/check - Check if slug is available
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

      // POST /slugs/link-request - Ask an admin to link an existing unowned profile
      .post(
        "/slugs/link-request",
        async ({
          body,
          userToken,
          profileMemberService,
          emailService,
          logger,
          set,
        }) =>
          requestProfileLinkLogic({
            uid: getUserUid(userToken, logger),
            slug: body.slug,
            profileMemberService,
            emailService,
            logger,
            set,
          }),
        {
          body: SetSlugBodySchema,
          response: RequestProfileLinkResponseSchema,
        },
      )

      // PUT /:slug - Update profile (must own slug or be admin)
      .put(
        "/:slug",
        async ({
          params,
          body,
          userToken,
          profileStoreService,
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
            profileStoreService,
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
          profileStoreService,
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
            profileStoreService,
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

          if (!userToken.email) {
            set.status = 400;
            return {
              error: "Authentication token did not contain an email address.",
            };
          }

          const email = userToken.email;
          const isEmailVerified = userToken.email_verified ?? false;

          return claimProfileLogic({
            uid,
            email,
            emailVerified: isEmailVerified,
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
          profileStoreService,
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
            slug: params.slug,
            isAdmin: userToken?.["admin"] === true,
            imageData: body.imageData,
            profileMemberService,
            profileStoreService,
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
        async ({
          params,
          userToken,
          profileMemberService,
          profileStoreService,
          logger,
          set,
        }) => {
          await validateSlugOwnershipOrAdmin({
            urlSlug: params.slug,
            userToken,
            profileMemberService,
            logger,
          });

          return deleteImageLogic({
            uid: getUserUid(userToken, logger),
            slug: params.slug,
            isAdmin: userToken?.["admin"] === true,
            profileMemberService,
            profileStoreService,
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
