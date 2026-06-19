import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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
