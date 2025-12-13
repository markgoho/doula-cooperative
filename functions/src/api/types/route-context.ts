import type { Services } from "./services.js";

/**
 * Base route context with injected services.
 * Combines Elysia's context with our injected services.
 *
 * @template TParameters - Type of route parameters (e.g., { memberId: string })
 */
export interface RouteContext<TParameters = unknown> extends Services {
  params: TParameters;
  request: Request;
  set: { status?: number | string };
}

/**
 * Context for routes that don't require parameters.
 * Used for simple endpoints like health checks.
 */
export interface SimpleRouteContext extends Services {
  request: Request;
  set: { status?: number | string };
}
