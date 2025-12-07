import { onRequest } from "firebase-functions/v2/https";

export const profileDeploymentWebhook = onRequest(
  {
    invoker: "public",
    secrets: ["DEPLOY_WEBHOOK_SECRET", "MAILGUN_API_KEY"],
  },
  (request, response) =>
    import("./handler.js").then((m) => m.handler(request, response)),
);
