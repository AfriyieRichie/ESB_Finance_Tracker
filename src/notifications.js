import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';
import { isIOS, isStandalone } from './pwa';

// Web Push certificate key from Firebase Console → Project settings → Cloud Messaging.
// Without it, on-device notifications still work but the server can't push to this device.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/** 'granted' | 'denied' | 'default' | 'needs-install' (iPhone not added to home screen) | 'unsupported' */
export function notificationStatus() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  return Notification.permission;
}

const getRegistration = () => navigator.serviceWorker?.getRegistration();

// Registers this device with Firebase Cloud Messaging and stores its token so a server can push to it.
export async function registerPush(uid) {
  if (!VAPID_KEY || !uid || notificationStatus() !== 'granted') return false;
  try {
    if (!(await isSupported())) return false;
    const reg = await getRegistration();
    if (!reg) return false;
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return false;
    await setDoc(doc(db, 'users', uid, 'pushTokens', token), {
      token,
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Push registration failed:', err);
    return false;
  }
}

export async function enableNotifications(uid) {
  if (!('Notification' in window)) return { permission: notificationStatus(), push: false };
  const permission = await Notification.requestPermission();
  const push = permission === 'granted' ? await registerPush(uid) : false;
  return { permission, push };
}

// Shows a notification on this device (via the service worker, which Android requires).
export async function notify(title, body, tag) {
  if (notificationStatus() !== 'granted') return;
  const options = { body, tag, icon: '/pwa-192x192.png', data: { url: '/' } };
  try {
    const reg = await getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch (err) {
    console.warn('Could not show notification:', err);
  }
}

export const pushConfigured = () => !!VAPID_KEY;
