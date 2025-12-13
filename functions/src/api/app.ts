import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { healthRoute } from "./routes/health.js";
import { getMember } from "./routes/members.js";

// Node adapter required for Firebase Functions (Node.js runtime)
// No prefix - Firebase function name already provides /api
export const app = new Elysia({ adapter: node() })
  .get("/health", () => healthRoute())
  .get("/members/:memberId", (context) => getMember(context));
