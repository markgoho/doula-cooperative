import ImageKit from "imagekit";
import { HttpError } from "../../shared-api/errors/http-error.js";

const IMAGEKIT_ENDPOINT = "https://ik.imagekit.io/doulacoop";
const IMAGEKIT_PUBLIC_KEY = "public_PL5PBznSIhZ2PrWR9H";

/**
 * Get initialized ImageKit client instance.
 * Throws HttpError if required env vars are missing.
 */
export function getImageKitClient(): ImageKit {
  const privateKey = process.env["IMAGEKIT_PRIVATE_KEY"];
  const publicKey = process.env["IMAGEKIT_PUBLIC_KEY"];

  if (!privateKey || !publicKey) {
    throw new HttpError(
      "Missing ImageKit configuration (private or public key)",
      500,
    );
  }

  return new ImageKit({
    privateKey,
    publicKey: publicKey || IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: IMAGEKIT_ENDPOINT,
  });
}
