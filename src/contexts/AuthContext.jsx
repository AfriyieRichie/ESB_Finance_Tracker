import { createContext, useContext, useState, useEffect } from 'react';
import { app, auth, clearLocalData } from '../firebase';
import { DEMO, demoUser } from '../demo';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(DEMO ? demoUser : null);
  const [loading, setLoading] = useState(!DEMO);

  async function signup(email, password, displayName) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    return result;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Branded reset email from miahorropocket.com (Cloud Function + Resend); if that isn't
  // available, fall back to Firebase's built-in email so resets always work
  async function resetPassword(email) {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      await httpsCallable(getFunctions(app, 'europe-west2'), 'sendPasswordReset')({ email });
    } catch {
      await sendPasswordResetEmail(auth, email);
    }
  }

  // Sign out and remove this user's offline copy of their data from the device
  async function logout() {
    await signOut(auth);
    await clearLocalData();
  }

  useEffect(() => {
    if (DEMO) return;
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, signup, login, logout, resetPassword }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
