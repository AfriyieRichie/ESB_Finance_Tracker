import { useState, useEffect, useCallback } from 'react';

// Free, key-less daily rates (includes GHS). Second URL is the project's official fallback mirror.
const SOURCES = [
  base => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`,
  base => `https://latest.currency-api.pages.dev/v1/currencies/${base}.json`,
];

// Rates are published once a day (each response carries its date). Every device refreshes as soon
// as its saved rates are from before today, checking at most hourly, and never swaps a newer day's
// rates for an older copy, so all devices converge on the same published rate.
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
 * Daily exchange rates relative to `base`.
 * rates[CODE] = units of CODE per 1 unit of base (e.g. base GBP → rates.GHS ≈ 15.4).
 */
export function useExchangeRates(base) {
  const [entry,   setEntry]   = useState(() => readCache(base));
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const load = useCallback(async (force = false) => {
    const cached = readCache(base);
    setEntry(cached);
    const upToDate  = cached?.date && cached.date >= todayUTC();
    const checkedRecently = cached && Date.now() - cached.fetchedAt < RECHECK_MS;
    if (!force && cached && (upToDate || checkedRecently)) return;
    setLoading(true); setError('');
    try {
      const fresh = await fetchRates(base);
      if (cached?.date && fresh.date && fresh.date < cached.date) {
        writeCache(base, { ...cached, fetchedAt: Date.now() });   // got an older copy; keep ours
      } else {
        writeCache(base, fresh);
        setEntry(fresh);
      }
    } catch {
      setError('Could not fetch live exchange rates. Using last saved rates.');
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  return {
    rates:   entry?.rates || NO_RATES,
    date:    entry?.date  || null,
    loading, error,
    refresh: () => load(true),
  };
}
