import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import { connectFirestoreEmulator, getFirestore, provideFirestore } from '@angular/fire/firestore';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { windowProvider } from './services/window.token';

// Check if we should use emulators (defaults to true in dev mode)
const useEmulators = isDevMode() && !import.meta.env['VITE_USE_PRODUCTION'];

export const appConfig: ApplicationConfig = {
  providers: [
    windowProvider,
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    // Firebase providers
    provideFirebaseApp(() =>
      initializeApp({
        apiKey: 'AIzaSyBuYxpvwYc3ZVn5OSYtJe88XnL8x5HSuDI',
        authDomain: 'doula-cooperative.firebaseapp.com',
        projectId: 'doula-cooperative',
        storageBucket: 'doula-cooperative.firebasestorage.app',
        messagingSenderId: '577630356653',
        appId: '1:577630356653:web:9425c7a726ad13f051f224',
      }),
    ),

    provideAuth(() => {
      const auth = getAuth();
      if (useEmulators) {
        console.log('Connecting to Auth emulator');
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      }
      return auth;
    }),

    provideFirestore(() => {
      const firestore = getFirestore();
      if (useEmulators) {
        console.log('Connecting to Firestore emulator');
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),
  ],
};
