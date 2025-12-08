import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { PROFILE_SECRETS } from "../constants/profile-secrets.js";
import { ERROR_IDS } from "../constants/error-ids.js";

function validateGitHubSecrets(): [string, string, string] {
  const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
  const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
  const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
    logger.error("Missing GitHub secrets for profile image delete", {
      errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_FAILED,
      hasAppId: !!GITHUB_APP_ID,
      hasPrivateKey: !!GITHUB_PRIVATE_KEY,
      hasInstallationId: !!GITHUB_INSTALLATION_ID,
    });
    throw new HttpsError("internal", "Missing GitHub secrets.");
  }

  return [GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID];
}

export const deleteProfileImage = onCall(
  { invoker: "public", secrets: PROFILE_SECRETS },
  async request => {
    const secrets = validateGitHubSecrets();
    const { handler } = await import("./handler.js");
    return handler(request, secrets);
  },
);
