import {
  type ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import { connectFirestoreEmulator, getFirestore, provideFirestore } from '@angular/fire/firestore';
import { connectFunctionsEmulator, getFunctions, provideFunctions } from '@angular/fire/functions';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { windowProvider } from './services/window.token';

// Check if we should use emulators (defaults to true in dev mode)
const useEmulators = isDevMode() && !import.meta.env['VITE_USE_PRODUCTION'];

export const appConfig: ApplicationConfig = {
  providers: [
    windowProvider,
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
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
      } else {
        console.log('Using production Auth');
      }
      return auth;
    }),

    provideFirestore(() => {
      const firestore = getFirestore();
      if (useEmulators) {
        console.log('Connecting to Firestore emulator');
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      } else {
        console.log('Using production Firestore');
      }
      return firestore;
    }),

    provideFunctions(() => {
      const functions = getFunctions();
      if (useEmulators) {
        console.log('Connecting to Functions emulator');
        connectFunctionsEmulator(functions, 'localhost', 5001);
      } else {
        console.log('Using production Functions');
      }
      return functions;
    }),
  ],
};
