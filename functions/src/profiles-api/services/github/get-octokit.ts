import { App } from "octokit";
import { HttpError } from "../../../shared-api/errors/http-error.js";

/**
 * Get authenticated Octokit instance using GitHub App credentials.
 */
export async function getOctokit() {
  const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
  const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
  const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
    throw new HttpError("GitHub configuration is missing", 500);
  }

  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });

  return app.getInstallationOctokit(Number.parseInt(GITHUB_INSTALLATION_ID));
}
