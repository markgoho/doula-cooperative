import { node } from "@elysiajs/node";
import { Elysia, t } from "elysia";
import { logger as firebaseLogger } from "firebase-functions/v2";
import { healthRoute } from "./routes/health.js";
import { getMember } from "./routes/members.js";
import { AuthService } from "./services/auth-service/index.js";
import { MemberService } from "./services/member-service.js";
import type { RouteContext } from "./types/route-context.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Create Elysia app with injectable dependencies.
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  // Node adapter required because Firebase Functions v2 runs on Node.js runtime (not Bun)
  // No Elysia prefix needed - Firebase function named "api" already routes requests to /api/*
  return (
    new Elysia({ adapter: node() })
      // Register services for dependency injection into route handlers
      .decorate(
        SERVICE_KEYS.MEMBER_SERVICE,
        services?.memberService ?? MemberService,
      )
      .decorate(SERVICE_KEYS.AUTH_SERVICE, services?.authService ?? AuthService)
      .decorate(SERVICE_KEYS.LOGGER, services?.logger ?? firebaseLogger)
      // Routes
      .get("/health", () => healthRoute())
      .get(
        "/members/:memberId",
        context =>
          getMember(context as unknown as RouteContext<{ memberId: string }>),
        {
          params: t.Object({
            memberId: t.String({
              minLength: 1,
              maxLength: 128,
              description: "The Firestore document ID of the member",
              error:
                "Member ID must be a non-empty string (max 128 characters)",
            }),
          }),
        },
      )
  );
}

// Export default app instance with real services for production
export const app = createApp();
