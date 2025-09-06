import { isPlatformBrowser } from '@angular/common';
import { FactoryProvider, PLATFORM_ID } from '@angular/core';

export abstract class WindowReference {
  abstract get nativeWindow(): Window | Record<string, unknown>;
}

export class BrowserWindowReference extends WindowReference {
  get nativeWindow(): Window | Record<string, unknown> {
    return globalThis;
  }
}

export const windowProvider: FactoryProvider = {
  provide: WindowReference,
  useFactory: (platformId: object): WindowReference | Record<string, unknown> => {
    if (isPlatformBrowser(platformId)) {
      return new BrowserWindowReference();
    }
    return {
      nativeWindow: {},
    };
  },
  deps: [PLATFORM_ID],
};
