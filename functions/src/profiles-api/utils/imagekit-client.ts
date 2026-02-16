import ImageKit from "@imagekit/nodejs";
import { HttpError } from "../../shared-api/errors/http-error.js";

let cachedClient: ImageKit | undefined;

/**
 * Get initialized ImageKit client instance (lazy singleton).
 * Throws HttpError if required env vars are missing.
 */
export function getImageKitClient(): ImageKit {
  if (cachedClient) {
    return cachedClient;
  }

  const privateKey = process.env["IMAGEKIT_PRIVATE_KEY"];

  if (!privateKey) {
    throw new HttpError("Missing ImageKit configuration (private key)", 500);
  }

  cachedClient = new ImageKit({ privateKey });

  return cachedClient;
}

/** @internal Reset cached client (for tests only). */
export function _resetImageKitClient(): void {
  cachedClient = undefined;
}
