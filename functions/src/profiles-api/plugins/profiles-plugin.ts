import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { getUserUid } from "../../shared-api/utils/get-user-uid.js";
import { userDerive } from "../../shared-api/utils/user-derive.js";
import { userGuard } from "../../shared-api/utils/user-guard.js";
import {
  checkSlugAvailableLogic,
  claimProfileLogic,
  createProfileLogic,
  deleteImageLogic,
  readProfileLogic,
  setSlugLogic,
  uploadImageLogic,
  writeProfileLogic,
} from "../routes/index.js";
import {
  ProfileDataBodySchema,
  SetSlugBodySchema,
  SlugQuerySchema,
  UploadProfileImageBodySchema,
} from "../schemas/profile-schemas.js";
import { ProfileGitHubService } from "../services/github/index.js";
import { ProfileMemberService } from "../services/member/index.js";
import { SERVICE_KEYS, type PartialServices } from "../types/services.js";

/**
 * Create profiles plugin with centralized user authentication guard.
 * All routes in this plugin require user authentication.
 * Users can only access their own profile (/me pattern).
 *
 * Firebase rewrite: /api/profiles/** → profilesApi function
 * Plugin routes start from "/" - Firebase already provides /api/profiles prefix
 *
 * Routes for PR 1:
 * - /me (GET)     - Read current user's profile
 * - /me (PUT)     - Update current user's profile
 * - /me (POST)    - Create current user's profile
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia plugin with profile routes
 */
export function createProfilesPlugin(services?: PartialServices) {
  return new Elysia({ name: "profiles" })
    .decorate(
      SERVICE_KEYS.PROFILE_GITHUB_SERVICE,
      services?.profileGitHubService ?? ProfileGitHubService,
    )
    .decorate(
      SERVICE_KEYS.PROFILE_MEMBER_SERVICE,
      services?.profileMemberService ?? ProfileMemberService,
    )
    .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
    .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
    .derive(userDerive)
    .onBeforeHandle({ as: "local" }, userGuard)
    // GET /me - Read current user's profile (served at /api/profiles/me)
    .get(
      "/me",
      async ({
        userToken,
        profileGitHubService,
        profileMemberService,
        logger,
        set,
      }) =>
        readProfileLogic({
          uid: getUserUid(userToken, logger),
          profileGitHubService,
          profileMemberService,
          logger,
          set,
        }),
    )
    // PUT /me - Update current user's profile (served at /api/profiles/me)
    .put(
      "/me",
      async ({
        body,
        userToken,
        profileGitHubService,
        profileMemberService,
        logger,
        set,
      }) =>
        writeProfileLogic({
          uid: getUserUid(userToken, logger),
          data: body,
          profileGitHubService,
          profileMemberService,
          logger,
          set,
        }),
      { body: ProfileDataBodySchema },
    )
    // POST /me - Create current user's profile (served at /api/profiles/me)
    .post(
      "/me",
      async ({
        body,
        userToken,
        profileGitHubService,
        profileMemberService,
        logger,
        set,
      }) =>
        createProfileLogic({
          uid: getUserUid(userToken, logger),
          data: body,
          profileGitHubService,
          profileMemberService,
          logger,
          set,
        }),
      { body: ProfileDataBodySchema },
    )
    // GET /slugs/check - Check slug availability (served at /api/profiles/slugs/check?slug=jane-doe)
    .get(
      "/slugs/check",
      async ({ query, profileMemberService, logger, set }) =>
        checkSlugAvailableLogic({
          slug: query.slug,
          profileMemberService,
          logger,
          set,
        }),
      { query: SlugQuerySchema },
    )
    // POST /slugs/me - Set current user's slug (served at /api/profiles/slugs/me)
    .post(
      "/slugs/me",
      async ({ body, userToken, profileMemberService, logger, set }) =>
        setSlugLogic({
          uid: getUserUid(userToken, logger),
          slug: body.slug,
          profileMemberService,
          logger,
          set,
        }),
      { body: SetSlugBodySchema },
    )
    // POST /me/claim - Claim unclaimed profile (served at /api/profiles/me/claim)
    .post("/me/claim", async ({ userToken, logger, set }) => {
      // Guard ensures userToken exists, but TypeScript doesn't know that
      if (!userToken) {
        set.status = 401;
        return { error: "Authentication required" };
      }

      const uid = getUserUid(userToken, logger);
      const email = userToken.email;
      const emailVerified = userToken.email_verified ?? false;

      if (!email) {
        set.status = 400;
        return { error: "Authentication token did not contain an email address." };
      }

      return claimProfileLogic({
        uid,
        email,
        emailVerified,
        logger,
        set,
      });
    })
    // POST /me/image - Upload profile image (served at /api/profiles/me/image)
    .post(
      "/me/image",
      async ({ body, userToken, profileMemberService, logger, set }) =>
        uploadImageLogic({
          uid: getUserUid(userToken, logger),
          imageData: body.imageData,
          cropData: body.cropData,
          profileMemberService,
          logger,
          set,
        }),
      { body: UploadProfileImageBodySchema },
    )
    // DELETE /me/image - Delete profile image (served at /api/profiles/me/image)
    .delete("/me/image", async ({ userToken, profileMemberService, logger, set }) =>
      deleteImageLogic({
        uid: getUserUid(userToken, logger),
        profileMemberService,
        logger,
        set,
      }),
    );
}
