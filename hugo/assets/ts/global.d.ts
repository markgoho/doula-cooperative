interface Grecaptcha {
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

declare global {
  interface Window {
    grecaptcha: Grecaptcha;
  }

  // Extend globalThis to include grecaptcha
  var grecaptcha: Grecaptcha;
}

// Empty export to make this a module
// eslint-disable-next-line unicorn/require-module-specifiers
export {};
