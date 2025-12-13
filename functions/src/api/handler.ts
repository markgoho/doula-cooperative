import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";

export async function handleApi(
  request: Request,
  response: Response,
): Promise<void> {
  const { app } = await import("./app.js");
  const { toWebRequest, sendWebResponse } = await import("./adapters.js");

  const webResponse = (await app.handle(
    toWebRequest(request),
  )) as globalThis.Response;
  await sendWebResponse(webResponse, response);
}
