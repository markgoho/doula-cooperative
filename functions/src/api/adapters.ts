import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";

export function toWebRequest(request: Request): globalThis.Request {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url, `https://${host}`);
  return new globalThis.Request(url.toString(), {
    method: request.method,
    headers: request.headers as Record<string, string>,
    body: ["GET", "HEAD"].includes(request.method)
      ? undefined
      : (request as Request & { rawBody?: Buffer }).rawBody,
  });
}

export async function sendWebResponse(
  webResponse: globalThis.Response,
  response: Response,
): Promise<void> {
  response.status(webResponse.status);
  for (const [key, value] of webResponse.headers) {
    response.setHeader(key, value);
  }
  response.send(await webResponse.text());
}
