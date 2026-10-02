import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';
import { isIOS, isStandalone } from './pwa';

// Public Web Push certificate key (Firebase Console → Project settings → Cloud Messaging).
// Safe to ship in client code; lets the scheduled function push to this device.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  'BOowU0DWcCpXtURlqCYgEOnYLmvfrv_q0-EMJJfqSETvUtzlBRED9nSqTvIFIJParwfovbxEI347Vvw5DSBDm4E';

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
      timeZone:  Intl.DateTimeFormat().resolvedOptions().timeZone,   // reminders go out at local time
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

// Resolves with a service worker registration that has an ACTIVE worker. Right after install the
// worker may still be starting, and showNotification() throws until it's active. Gives up after 10s.
function activeRegistration() {
  if (!navigator.serviceWorker) return Promise.resolve(null);
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise(resolve => setTimeout(() => resolve(null), 10000)),
  ]);
}

// Shows a notification on this device (via the service worker, which Android requires).
// Returns { ok: true } or { ok: false, reason } so callers can tell the user what happened.
export async function notify(title, body, tag) {
  if (notificationStatus() !== 'granted') return { ok: false, reason: 'Notifications are not allowed on this device.' };
  const options = { body, tag, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', data: { url: '/' } };
  try {
    const reg = await activeRegistration();
    if (reg) {
      await reg.showNotification(title, options);
    } else {
      new Notification(title, options);   // desktop browsers without a service worker (e.g. dev)
    }
    return { ok: true };
  } catch (err) {
    console.warn('Could not show notification:', err);
    return { ok: false, reason: err?.message || 'The browser refused to show the notification.' };
  }
}

export const pushConfigured = () => !!VAPID_KEY;
