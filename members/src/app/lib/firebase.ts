import { isDevMode } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBuYxpvwYc3ZVn5OSYtJe88XnL8x5HSuDI',
  authDomain: 'doula-cooperative.firebaseapp.com',
  projectId: 'doula-cooperative',
  storageBucket: 'doula-cooperative.firebasestorage.app',
  messagingSenderId: '577630356653',
  appId: '1:577630356653:web:9425c7a726ad13f051f224',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// In local dev, point Auth at the emulator unless explicitly opted into
// production (VITE_USE_PRODUCTION). Production builds skip this entirely.
if (isDevMode() && !import.meta.env['VITE_USE_PRODUCTION']) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
}
