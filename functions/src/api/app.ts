import { Elysia, t } from "elysia";
import { node } from "@elysiajs/node";
import { healthRoute } from "./routes/health.js";
import { getMember } from "./routes/members.js";
import { MemberService } from "./services/member-service.js";
import { AuthService } from "./services/auth-service.js";
import { SERVICE_KEYS, type PartialServices } from "./types/services.js";

/**
 * Create Elysia app with injectable dependencies.
 *
 * @param services - Optional services to inject (defaults to real implementations)
 * @returns Configured Elysia app instance
 */
export function createApp(services?: PartialServices) {
  // Node adapter required for Firebase Functions (Node.js runtime)
  // No prefix - Firebase function name already provides /api
  return new Elysia({ adapter: node() })
    // Inject services into context for dependency injection
    .decorate(
      SERVICE_KEYS.MEMBER_SERVICE,
      services?.memberService ?? MemberService,
    )
    .decorate(
      SERVICE_KEYS.AUTH_SERVICE,
      services?.authService ?? AuthService,
    )
    // Routes
    .get("/health", () => healthRoute())
    .get(
      "/members/:memberId",
      (context) => getMember(context),
      {
        params: t.Object({
          memberId: t.String({
            minLength: 1,
            maxLength: 128,
            description: "The Firestore document ID of the member",
            error: "Member ID must be a non-empty string (max 128 characters)",
          }),
        }),
      },
    );
}

// Export default app instance with real services for production
export const app = createApp();
