import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SAVINGS_CATEGORIES } from '../hooks/useFinanceData';
import { useExchangeRates } from '../hooks/useExchangeRates';

// ─── Currency catalogue ────────────────────────────────────────────────────

export const CURRENCIES = [
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi'         },
  { code: 'USD', symbol: '$',    name: 'US Dollar'             },
  { code: 'GBP', symbol: '£',   name: 'British Pound'         },
  { code: 'EUR', symbol: '€',   name: 'Euro'                  },
  { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira'        },
  { code: 'ZAR', symbol: 'R',   name: 'South African Rand'    },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling'       },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc'},
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar'       },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar'     },
];

export const symbolFor = (code) => CURRENCIES.find(c => c.code === code)?.symbol || code;

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  currency:          'GHS',     // base currency: totals, budgets and reports are converted into it
  fxOverrides:       {},        // { "GBP:GHS": 15.2 } = your own rate, units of GHS per 1 GBP
  theme:             'dark',
  numberFormat:      'comma',   // 'comma' = 1,000.00 | 'period' = 1.000,00
  budgetStartDay:    1,
  hideBalances:      false,
  pinHash:           null,
  autoLockTimeout:   5,         // minutes; 0 = never; -1 = immediately on blur
  hiddenCategories:  [],        // ["expense:Housing", ...]
  customCategories:  [],        // [{ type, name, icon, color }, ...]
  notifications: {
    billReminders:              true,
    budgetAlert:                true,
    weeklyDigest:               true,
    largeTransaction:           false,
    goalMilestone:              true,
    largeTransactionThreshold:  500,
  },
};

// ─── Theme helper ──────────────────────────────────────────────────────────

function applyTheme(theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effective   = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  document.documentElement.setAttribute('data-theme', effective);
  localStorage.setItem('theme', theme);
}

// ─── Context ───────────────────────────────────────────────────────────────

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children, userId }) {
  const [prefs, setPrefs] = useState(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    return { ...DEFAULT_PREFS, theme: savedTheme };
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [locked, setLocked]             = useState(false);

  // ── Load from Firestore ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setPrefsLoading(false); return; }
    const unsub = onSnapshot(
      doc(db, 'users', userId, 'preferences', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data   = snap.data();
          const merged = {
            ...DEFAULT_PREFS,
            ...data,
            notifications: { ...DEFAULT_PREFS.notifications, ...data.notifications },
          };
          setPrefs(merged);
          applyTheme(merged.theme);
          // Show lock screen if PIN is set (only on first load)
          if (merged.pinHash) setLocked(prev => prev || true);
        }
        setPrefsLoading(false);
      }
    );
    return unsub;
  }, [userId]);

  // ── React to system theme changes ──────────────────────────────────────
  useEffect(() => {
    if (prefs.theme !== 'system') return;
    const mq      = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [prefs.theme]);

  // ── Write helpers ──────────────────────────────────────────────────────
  const updatePrefs = useCallback(async (updates) => {
    setPrefs(p => ({ ...p, ...updates }));
    if (updates.theme) applyTheme(updates.theme);
    if (userId) {
      await setDoc(doc(db, 'users', userId, 'preferences', 'main'), updates, { merge: true });
    }
  }, [userId]);

  const updateNotifications = useCallback(async (notifUpdates) => {
    setPrefs(p => {
      const next = { ...p, notifications: { ...p.notifications, ...notifUpdates } };
      if (userId) {
        setDoc(doc(db, 'users', userId, 'preferences', 'main'),
          { notifications: next.notifications }, { merge: true });
      }
      return next;
    });
  }, [userId]);

  // ── Currency & exchange rates ──────────────────────────────────────────
  const baseCurrency   = prefs.currency;
  const currencySymbol = symbolFor(baseCurrency);
  const fx             = useExchangeRates(baseCurrency);
  const liveRates      = fx.rates;
  const fxOverrides    = prefs.fxOverrides;

  // Units of `code` per 1 unit of base currency; null if unknown
  const rateFor = useCallback((code) => {
    if (!code || code === baseCurrency) return 1;
    const override = fxOverrides?.[`${baseCurrency}:${code}`];
    if (override > 0) return override;
    return liveRates[code] ?? null;
  }, [baseCurrency, fxOverrides, liveRates]);

  // Converts between any two currencies via the base; null if a rate is missing
  const convert = useCallback((amount, from, to) => {
    const n = Number(amount) || 0;
    if ((from || baseCurrency) === (to || baseCurrency)) return n;
    const rFrom = rateFor(from), rTo = rateFor(to);
    return rFrom && rTo ? (n / rFrom) * rTo : null;
  }, [baseCurrency, rateFor]);

  const toBase = useCallback((amount, code) => convert(amount, code, baseCurrency), [convert, baseCurrency]);

  // Fields saved on a new transaction so its base value is frozen at today's rate
  const txFxMeta = useCallback((code) => {
    const cur = code || baseCurrency;
    const r   = rateFor(cur);
    return r ? { currency: cur, baseCurrency, fxRate: 1 / r } : { currency: cur };
  }, [rateFor, baseCurrency]);

  const setFxOverride = useCallback(async (code, value) => {
    const key  = `${baseCurrency}:${code}`;
    const next = { ...(prefs.fxOverrides || {}) };
    if (value > 0) next[key] = value; else delete next[key];
    setPrefs(p => ({ ...p, fxOverrides: next }));
    if (userId) await setDoc(doc(db, 'users', userId, 'preferences', 'main'), { fxOverrides: next }, { merge: true });
  }, [baseCurrency, prefs.fxOverrides, userId]);

  // ── Format functions ───────────────────────────────────────────────────
  // fmtCur formats in any currency; fmt formats in the base currency
  const fmtCur = useCallback((amount, code) => {
    const n   = Number(amount) || 0;
    const abs = Math.abs(n);
    let formatted;
    if (prefs.numberFormat === 'period') {
      // 1.000,00 style
      formatted = abs.toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, 'T')
        .replace('.', ',')
        .replace(/T/g, '.');
    } else {
      // 1,000.00 style (default)
      formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return `${n < 0 ? '-' : ''}${symbolFor(code || baseCurrency)} ${formatted}`;
  }, [baseCurrency, prefs.numberFormat]);

  const fmt = useCallback((amount) => fmtCur(amount, baseCurrency), [fmtCur, baseCurrency]);

  // ── Effective categories (built-ins ∪ custom − hidden) ─────────────────
  const effectiveCategories = useMemo(() => {
    const { hiddenCategories = [], customCategories = [] } = prefs;
    const filter = (cats, type) =>
      cats.filter(c => !hiddenCategories.includes(`${type}:${c.name}`));
    return {
      expense: [
        ...filter(EXPENSE_CATEGORIES, 'expense'),
        ...customCategories.filter(c => c.type === 'expense'),
      ],
      income: [
        ...filter(INCOME_CATEGORIES, 'income'),
        ...customCategories.filter(c => c.type === 'income'),
      ],
      savings: [
        ...filter(SAVINGS_CATEGORIES, 'savings'),
        ...customCategories.filter(c => c.type === 'savings'),
      ],
    };
  }, [prefs.hiddenCategories, prefs.customCategories]);

  const value = {
    prefs, updatePrefs, updateNotifications,
    fmt, fmtCur, currencySymbol,
    baseCurrency, rateFor, convert, toBase, txFxMeta, setFxOverride,
    liveRates, ratesDate: fx.date, ratesLoading: fx.loading, ratesError: fx.error, refreshRates: fx.refresh,
    locked, setLocked,
    prefsLoading,
    effectiveCategories,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences              = () => useContext(PreferencesContext);
export const useFmt                      = () => useContext(PreferencesContext).fmt;
export const useEffectiveCategoriesForType = (type) =>
  useContext(PreferencesContext).effectiveCategories[type] || [];
