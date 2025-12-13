import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";

/**
 * Convert Firebase Functions request to Web Request.
 * Handles header normalization and body conversion.
 *
 * @param request - Firebase Functions request object
 * @returns Web-standard Request object
 * @throws Error if URL construction fails or headers are invalid
 */
export function toWebRequest(request: Request): globalThis.Request {
  try {
    const host = request.headers.host ?? "localhost";
    const url = new URL(request.url, `https://${host}`);

    // Normalize headers - handle both string and array values
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") {
        headers.append(key, value);
      } else if (Array.isArray(value)) {
        // Handle multi-value headers (e.g., Set-Cookie)
        for (const v of value) {
          headers.append(key, v);
        }
      }
      // Skip non-string, non-array values
    }

    return new globalThis.Request(url.toString(), {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : (request as Request & { rawBody?: Buffer }).rawBody,
    });
  } catch (error) {
    throw new Error(
      `Failed to convert Firebase request to Web request: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Send Web Response to Express response object.
 * Handles both text and binary response bodies.
 *
 * @param webResponse - Web-standard Response object
 * @param response - Express response object
 * @throws Error if response cannot be sent
 */
export async function sendWebResponse(
  webResponse: globalThis.Response,
  response: Response,
): Promise<void> {
  try {
    response.status(webResponse.status);

    // Set response headers
    for (const [key, value] of webResponse.headers) {
      response.setHeader(key, value);
    }

    // Handle binary vs text responses based on content-type
    // Default to text if no content-type is specified
    const contentType = webResponse.headers.get("content-type") ?? "text/plain";
    if (
      contentType.includes("application/json") ||
      contentType.includes("text/") ||
      contentType.includes("application/xml") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      // Text-based content
      response.send(await webResponse.text());
    } else {
      // Binary content (images, PDFs, etc.)
      const buffer = Buffer.from(await webResponse.arrayBuffer());
      response.send(buffer);
    }
  } catch (error) {
    throw new Error(
      `Failed to send Web response to Express: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
