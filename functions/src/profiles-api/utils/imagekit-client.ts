import ImageKit from "imagekit";
import { HttpError } from "../../shared-api/errors/http-error.js";

const IMAGEKIT_ENDPOINT = "https://ik.imagekit.io/doulacoop";

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
  const publicKey = process.env["IMAGEKIT_PUBLIC_KEY"];

  if (!privateKey || !publicKey) {
    throw new HttpError(
      "Missing ImageKit configuration (private or public key)",
      500,
    );
  }

  cachedClient = new ImageKit({
    privateKey,
    publicKey,
    urlEndpoint: IMAGEKIT_ENDPOINT,
  });

  return cachedClient;
}

/** @internal Reset cached client (for tests only). */
export function _resetImageKitClient(): void {
  cachedClient = undefined;
}
