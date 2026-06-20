import ImageKit from "@imagekit/nodejs";
import { HttpError } from "../../shared-api/errors/http-error.js";

const clientCache: { instance: ImageKit | undefined } = { instance: undefined };

/**
 * Get initialized ImageKit client instance (lazy singleton).
 * Throws HttpError if required env vars are missing.
 */
export function getImageKitClient(): ImageKit {
  if (clientCache.instance) {
    return clientCache.instance;
  }

  const privateKey = process.env["IMAGEKIT_PRIVATE_KEY"];

  if (!privateKey) {
    throw new HttpError("Missing ImageKit configuration (private key)", 500);
  }

  clientCache.instance = new ImageKit({ privateKey });

  return clientCache.instance;
}

/** @internal Reset cached client (for tests only). */
export function _resetImageKitClient(): void {
  clientCache.instance = undefined;
}
