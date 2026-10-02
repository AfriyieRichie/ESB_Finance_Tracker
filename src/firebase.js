import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  terminate, clearIndexedDbPersistence,
} from 'firebase/firestore';

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

// Keep a copy of the user's data on the device (IndexedDB) so the app loads and
// accepts changes offline; queued writes sync automatically when back online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// Firestore applies a write to the local cache immediately but only resolves the promise once
// the server confirms it. Offline that never happens until reconnect, so don't make the UI wait;
// the write stays queued on the device and syncs later.
export function whenSaved(promise) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    promise.catch(err => console.error('Offline write failed to sync:', err));
    return Promise.resolve();
  }
  return promise;
}

// Wipe the on-device copy of the data (on sign-out / account deletion), then reload,
// since a terminated Firestore instance can't be reused.
export async function clearLocalData() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (err) {
    // Fails if another tab still has the app open; that tab keeps the cache until it closes.
    console.warn('Could not clear offline data:', err);
  }
  window.location.reload();
}
