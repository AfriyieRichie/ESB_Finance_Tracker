import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCKedL38XMnc9IWfo_M260TyIHbpubVqRs",
  authDomain: "esb-finance-tracker.firebaseapp.com",
  projectId: "esb-finance-tracker",
  storageBucket: "esb-finance-tracker.firebasestorage.app",
  messagingSenderId: "603105872869",
  appId: "1:603105872869:web:09b3a86d7c5b5d938cbd0c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
