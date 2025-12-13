import type { Services } from "./services.js";

/**
 * Base route context with injected services.
 * Extend this for specific route requirements.
 */
export type RouteContext<TParameters = unknown> = {
  params: TParameters;
  request: Request;
  set: { status?: number | string };
} & Services;

/**
 * Context for routes that don't need params.
 */
export type SimpleRouteContext = Omit<RouteContext, "params">;
