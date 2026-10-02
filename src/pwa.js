import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

// Service worker with auto-update: when a new version has been downloaded it takes over and the
// page reloads onto it, instead of showing the old cached version until a manual refresh.
// Also look for a new version whenever the app is reopened/refocused, and hourly while open.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => { if (navigator.onLine) registration.update(); };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, 60 * 60 * 1000);
  },
});

// The browser fires `beforeinstallprompt` once, possibly before React mounts, so capture it at
// module load (imported from main.jsx) and let components subscribe to it.
let deferredPrompt = null;
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // we show our own Install button/banner instead of Chrome's mini-bar
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; emit(); });
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS reports as Mac

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function useInstall() {
  const prompt = useSyncExternalStore(subscribe, () => deferredPrompt);
  const installed = isStandalone();
  return {
    installed,
    canPrompt: !!prompt && !installed,              // Android / desktop Chrome & Edge
    iosManual: isIOS() && !installed,               // iPhone/iPad: must use Share → Add to Home Screen
    promptInstall: async () => {
      if (!prompt) return false;
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      deferredPrompt = null; emit();
      return outcome === 'accepted';
    },
  };
}
