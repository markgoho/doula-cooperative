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
    const headers = normalizeHeaders(request.headers);
    const body = getRequestBody(request);

    return new globalThis.Request(url.toString(), {
      method: request.method,
      headers,
      body,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to convert Firebase request to Web request: ${errorMessage}`);
  }
}

/**
 * Normalize headers from Firebase request format to Web Headers.
 * Handles both string and array header values.
 */
function normalizeHeaders(requestHeaders: Request["headers"]): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(requestHeaders)) {
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

  return headers;
}

/**
 * Extract request body based on HTTP method.
 * GET and HEAD requests should not have a body.
 */
function getRequestBody(request: Request): Buffer | undefined {
  const methodsWithoutBody = ["GET", "HEAD"];

  if (methodsWithoutBody.includes(request.method)) {
    return undefined;
  }

  return (request as Request & { rawBody?: Buffer }).rawBody;
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
  response.status(webResponse.status);

  // Set response headers
  for (const [key, value] of webResponse.headers) {
    response.setHeader(key, value);
  }

  // Determine response body format based on content type
  const responseBody = await getResponseBody(webResponse);
  response.send(responseBody);
}

/**
 * Extract response body in appropriate format based on content type.
 * Text-based content is returned as string, binary content as Buffer.
 */
async function getResponseBody(webResponse: globalThis.Response): Promise<string | Buffer> {
  const contentType = webResponse.headers.get("content-type") ?? "text/plain";

  const textContentTypes = [
    "application/json",
    "text/",
    "application/xml",
    "application/x-www-form-urlencoded",
  ];

  const isTextContent = textContentTypes.some((type) => contentType.includes(type));

  if (isTextContent) {
    return webResponse.text();
  }

  // Binary content (images, PDFs, etc.)
  const arrayBuffer = await webResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
