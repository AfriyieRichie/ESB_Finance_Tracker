import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SAVINGS_CATEGORIES } from '../hooks/useFinanceData';

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
];

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  currency:          'GHS',
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

  // ── Currency symbol ────────────────────────────────────────────────────
  const currencySymbol = useMemo(() =>
    CURRENCIES.find(c => c.code === prefs.currency)?.symbol || 'GH₵',
    [prefs.currency]
  );

  // ── Format function ────────────────────────────────────────────────────
  const fmt = useCallback((amount) => {
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
    return `${n < 0 ? '-' : ''}${currencySymbol} ${formatted}`;
  }, [currencySymbol, prefs.numberFormat]);

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
    fmt, currencySymbol,
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
