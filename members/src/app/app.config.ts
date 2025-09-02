import {
  ApplicationConfig,
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

export const appConfig: ApplicationConfig = {
  providers: [
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
      // Connect to the Auth emulator in development
      if (isDevMode()) {
        console.log('Connecting to Auth emulator');
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      }
      return auth;
    }),

    provideFirestore(() => {
      const firestore = getFirestore();
      // Connect to the Firestore emulator in development
      if (isDevMode()) {
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),

    provideFunctions(() => {
      const functions = getFunctions();
      // Connect to the Functions emulator in development
      if (isDevMode()) {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      return functions;
    }),
  ],
};
