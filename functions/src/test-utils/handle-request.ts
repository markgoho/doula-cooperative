/**
 * Typed wrapper around Elysia's `.handle()` method for use in tests.
 *
 * Elysia's `.handle()` returns `Promise<any>` (library limitation),
 * which triggers `@typescript-eslint/no-unsafe-*` lint errors at every callsite.
 * This wrapper centralizes the type assertion so test files stay lint-clean.
 */
export async function handleRequest(
  app: { handle: (request: Request) => Promise<Response> },
  request: Request,
): Promise<Response> {
  return app.handle(request);
}
