import { createContext, useContext, useState, useEffect } from 'react';
import { auth, clearLocalData } from '../firebase';
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

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
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
