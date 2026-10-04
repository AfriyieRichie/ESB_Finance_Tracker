import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Free, key-less daily rates (includes GHS). Second URL is the project's official fallback mirror.
const SOURCES = [
  base => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`,
  base => `https://latest.currency-api.pages.dev/v1/currencies/${base}.json`,
];

// Rates are published once a day (each response carries its date). The copy saved in the user's
// account (users/{uid}/meta/fx-{BASE}) is the single source of truth: whenever it exists, every
// device converts with exactly that copy, so totals are identical everywhere. This device's own
// saved copy is only a fallback (offline / before the account copy loads). A device fetches from the
// internet when the account copy is from before today (at most hourly) and only replaces it with a
// newer day's rates.
const RECHECK_MS = 60 * 60 * 1000;
const todayUTC   = () => new Date().toISOString().slice(0, 10);
const NO_RATES   = {};
const cacheKey   = base => `fx-rates-${base}`;

function readCache(base) {
  try {
    const raw = localStorage.getItem(cacheKey(base));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(base, entry) {
  try { localStorage.setItem(cacheKey(base), JSON.stringify(entry)); } catch { /* storage unavailable */ }
}

async function fetchRates(base) {
  const lower = base.toLowerCase();
  let lastErr;
  for (const src of SOURCES) {
    try {
      const res = await fetch(src(lower));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json  = await res.json();
      const rates = {};
      Object.entries(json[lower] || {}).forEach(([code, v]) => {
        if (typeof v === 'number' && v > 0) rates[code.toUpperCase()] = v;
      });
      return { rates, date: json.date || null, fetchedAt: Date.now() };
    } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

/**
 * Daily exchange rates relative to `base`, shared across the user's devices.
 * rates[CODE] = units of CODE per 1 unit of base (e.g. base GBP → rates.GHS ≈ 15.5).
 */
export function useExchangeRates(base, userId) {
  const [entry,   setEntry]   = useState(() => readCache(base));
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const sharedRef = useRef(null);   // latest copy saved in the user's account

  const applyRates = useCallback((rates, extra = {}) => {
    writeCache(base, { ...rates, ...extra });
    setEntry(rates);
  }, [base]);

  const load = useCallback(async (force = false) => {
    const local   = readCache(base);
    const current = sharedRef.current || local;
    if (current) setEntry(current);
    const upToDate = current?.date && current.date >= todayUTC();
    const checkedRecently = local && Date.now() - (local.checkedAt || local.fetchedAt || 0) < RECHECK_MS;
    if (!force && current && (upToDate || checkedRecently)) return;
    setLoading(true); setError('');
    try {
      const fresh  = await fetchRates(base);
      const shared = sharedRef.current;
      if (shared?.date && (!fresh.date || fresh.date <= shared.date)) {
        applyRates(shared, { checkedAt: Date.now() });          // account copy is as new: everyone keeps it
      } else {
        applyRates(fresh, { checkedAt: Date.now() });
        if (userId) setDoc(doc(db, 'users', userId, 'meta', `fx-${base}`), fresh).catch(() => {});
      }
    } catch {
      setError('Could not fetch live exchange rates. Using last saved rates.');
    } finally {
      setLoading(false);
    }
  }, [base, userId, applyRates]);

  // Live copy from the account: whichever device fetched the newest rates, every device uses them
  useEffect(() => {
    sharedRef.current = null;
    if (!userId) { load(); return undefined; }
    let first = true;
    const start = () => { if (first) { first = false; load(); } };
    const unsub = onSnapshot(doc(db, 'users', userId, 'meta', `fx-${base}`), (snap) => {
      const shared = snap.exists() ? snap.data() : null;
      sharedRef.current = shared;
      if (shared?.rates) applyRates(shared, { checkedAt: readCache(base)?.checkedAt });
      start();
    }, start);
    return unsub;
  }, [base, userId, load, applyRates]);

  return {
    rates:   entry?.rates || NO_RATES,
    date:    entry?.date  || null,
    loading, error,
    refresh: () => load(true),
  };
}
