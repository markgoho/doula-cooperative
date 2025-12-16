import { Elysia } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { AuthService } from "../../shared-api/services/auth/index.js";
import { getUserUid } from "../../shared-api/utils/get-user-uid.js";
import { userDerive } from "../../shared-api/utils/user-derive.js";
import { userGuard } from "../../shared-api/utils/user-guard.js";
import {
  createProfileLogic,
  readProfileLogic,
  writeProfileLogic,
} from "../routes/index.js";
import { ProfileDataBodySchema } from "../schemas/profile-schemas.js";
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
    );
}
