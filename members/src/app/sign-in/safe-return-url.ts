const DEFAULT_RETURN_URL = '/membership';

/**
 * Where to go after sign-in: the requested `returnUrl` when it is a
 * same-origin relative path (starts with `/`, not `//` or `/\`), otherwise
 * `/membership`. Blocks open redirects to other origins.
 */
export function safeReturnUrl(returnUrl: string | undefined): string {
  if (!returnUrl?.startsWith('/')) return DEFAULT_RETURN_URL;
  if (returnUrl.startsWith('//') || returnUrl.startsWith('/\\')) return DEFAULT_RETURN_URL;
  return returnUrl;
}
