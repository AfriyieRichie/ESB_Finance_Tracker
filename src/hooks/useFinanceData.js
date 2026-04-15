import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, doc, addDoc, deleteDoc, setDoc, onSnapshot,
  updateDoc, increment, writeBatch,
} from 'firebase/firestore';

// ─── Expense Categories ────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  { name: 'Housing',        icon: '🏠', color: '#00e676' },
  { name: 'Food & Dining',  icon: '🍔', color: '#06b6d4' },
  { name: 'Transportation', icon: '🚗', color: '#2affa0' },
  { name: 'Entertainment',  icon: '🎬', color: '#4ade80' },
  { name: 'Healthcare',     icon: '💊', color: '#34d399' },
  { name: 'Shopping',       icon: '🛍️', color: '#00b85a' },
  { name: 'Utilities',      icon: '⚡', color: '#6ee7b7' },
  { name: 'Education',      icon: '📚', color: '#00cc6a' },
  { name: 'Personal Care',  icon: '✨', color: '#86efac' },
  { name: 'Debt Repayment', icon: '💳', color: '#f59e0b' },
  { name: 'Other',          icon: '📦', color: '#7db896' },
];

export const INCOME_CATEGORIES = [
  { name: 'Salary',    icon: '💼', color: '#00e676' },
  { name: 'Dividend',  icon: '📈', color: '#2affa0' },
  { name: 'Interest',  icon: '🏦', color: '#4ade80' },
  { name: 'Business',  icon: '🏢', color: '#06b6d4' },
  { name: 'Freelance', icon: '💻', color: '#34d399' },
  { name: 'Rental',    icon: '🏡', color: '#00b85a' },
  { name: 'Others',    icon: '📦', color: '#7db896' },
];

export const SAVINGS_CATEGORIES = [
  { name: 'Emergency Fund',  icon: '🛡️', color: '#00e676' },
  { name: 'Stock Portfolio', icon: '📊', color: '#2affa0' },
  { name: 'Pension Fund',    icon: '👴', color: '#06b6d4' },
  { name: 'Fixed Deposit',   icon: '🏦', color: '#4ade80' },
  { name: 'Cryptocurrency',  icon: '₿',  color: '#34d399' },
  { name: 'Real Estate',     icon: '🏡', color: '#00b85a' },
  { name: 'Mutual Funds',    icon: '💹', color: '#6ee7b7' },
  { name: 'Others',          icon: '💰', color: '#7db896' },
];

export const CATEGORIES     = EXPENSE_CATEGORIES;
export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SAVINGS_CATEGORIES];

export function getCategoriesForType(type) {
  if (type === 'income')  return INCOME_CATEGORIES;
  if (type === 'savings') return SAVINGS_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

export function getCategoryInfo(name) {
  return ALL_CATEGORIES.find(c => c.name === name) ?? { name, icon: '📦', color: '#94a3b8' };
}

// ─── Account & Asset Metadata ──────────────────────────────────────────────

export const ACCOUNT_TYPES = [
  { id: 'bank',   label: 'Bank Account',  color: '#3b82f6' },
  { id: 'momo',   label: 'Mobile Money',  color: '#eab308' },
  { id: 'cash',   label: 'Cash',          color: '#22c55e' },
  { id: 'other',  label: 'Other',         color: '#6b7280' },
];

export const ASSET_TYPES = [
  { id: 'tbill',      label: 'Treasury Bill',        color: '#06b6d4' },
  { id: 'fixed',      label: 'Fixed Deposit',         color: '#3b82f6' },
  { id: 'susu',       label: 'Susu / Group Savings',  color: '#00a854' },
  { id: 'property',   label: 'Property / Land',       color: '#f59e0b' },
  { id: 'crypto',     label: 'Cryptocurrency',         color: '#8b5cf6' },
  { id: 'stocks',     label: 'Stocks / Shares',        color: '#ec4899' },
  { id: 'mutualfund', label: 'Mutual Fund',            color: '#14b8a6' },
  { id: 'other',      label: 'Other',                  color: '#6b7280' },
];

export const POPULAR_ACCOUNTS = [
  { name: 'GCB Bank',     type: 'bank',  color: '#e41e20' },
  { name: 'Absa',         type: 'bank',  color: '#b31012' },
  { name: 'Ecobank',      type: 'bank',  color: '#0072bc' },
  { name: 'Fidelity',     type: 'bank',  color: '#4f46e5' },
  { name: 'Stanbic',      type: 'bank',  color: '#0ea5e9' },
  { name: 'Cal Bank',     type: 'bank',  color: '#7c3aed' },
  { name: 'MTN MoMo',     type: 'momo',  color: '#eab308' },
  { name: 'Telecel Cash', type: 'momo',  color: '#dc2626' },
  { name: 'AirtelTigo',   type: 'momo',  color: '#f97316' },
  { name: 'Cash',         type: 'cash',  color: '#22c55e' },
  { name: 'Other',        type: 'other', color: '#6b7280' },
];

// Maps savings category → asset type ID for auto-linking
export const SAVINGS_TO_ASSET_TYPE = {
  'Emergency Fund':  'other',
  'Stock Portfolio': 'stocks',
  'Pension Fund':    'other',
  'Fixed Deposit':   'fixed',
  'Cryptocurrency':  'crypto',
  'Real Estate':     'property',
  'Mutual Funds':    'mutualfund',
  'Others':          'other',
};

// Maps asset type ID → savings category for auto-created transactions
const ASSET_TYPE_TO_CATEGORY = {
  tbill:      'Fixed Deposit',
  fixed:      'Fixed Deposit',
  susu:       'Emergency Fund',
  property:   'Real Estate',
  crypto:     'Cryptocurrency',
  stocks:     'Stock Portfolio',
  mutualfund: 'Mutual Funds',
  other:      'Others',
};

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useFinanceData(userId) {
  const [transactions, setTransactions] = useState([]);
  const [budgets,      setBudgets]      = useState([]);
  const [accounts,     setAccounts]     = useState([]);
  const [debts,        setDebts]        = useState([]);
  const [assets,       setAssets]       = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    if (!userId) return;

    const loaded = { tx: false, budgets: false, accounts: false, debts: false, assets: false };
    const checkDone = () => { if (Object.values(loaded).every(Boolean)) setLoading(false); };

    const unsubTx = onSnapshot(
      collection(db, 'users', userId, 'transactions'),
      snap => { setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))); loaded.tx = true; checkDone(); }
    );
    const unsubBudgets = onSnapshot(
      collection(db, 'users', userId, 'budgets'),
      snap => { setBudgets(snap.docs.map(d => ({ type: 'expense', ...d.data(), id: d.id }))); loaded.budgets = true; checkDone(); }
    );
    const unsubAccounts = onSnapshot(
      collection(db, 'users', userId, 'accounts'),
      snap => { setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); loaded.accounts = true; checkDone(); }
    );
    const unsubDebts = onSnapshot(
      collection(db, 'users', userId, 'debts'),
      snap => { setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); loaded.debts = true; checkDone(); }
    );
    const unsubAssets = onSnapshot(
      collection(db, 'users', userId, 'assets'),
      snap => { setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() }))); loaded.assets = true; checkDone(); }
    );

    return () => { unsubTx(); unsubBudgets(); unsubAccounts(); unsubDebts(); unsubAssets(); };
  }, [userId]);

  // ── Transactions ────────────────────────────────────────────────────────

  const addTransaction = useCallback(async (t) => {
    const batch = writeBatch(db);

    // Write transaction
    const txRef = doc(collection(db, 'users', userId, 'transactions'));
    batch.set(txRef, t);

    // Update account balance
    const delta = t.type === 'income' ? t.amount : -t.amount;
    batch.update(doc(db, 'users', userId, 'accounts', t.accountId), { balance: increment(delta) });

    // If debt repayment, reduce debt balance
    if (t.debtId) {
      batch.update(doc(db, 'users', userId, 'debts', t.debtId), { currentBalance: increment(-t.amount) });
    }

    // If savings linked to an asset, increase cost basis
    if (t.type === 'savings' && t.assetId) {
      batch.update(doc(db, 'users', userId, 'assets', t.assetId), {
        costBasis:    increment(t.amount),
        currentValue: increment(t.amount),
      });
    }

    await batch.commit();
  }, [userId]);

  const deleteTransaction = useCallback(async (id) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId, 'transactions', id));

    if (tx.type === 'transfer') {
      // Reverse both sides of the transfer
      if (tx.fromAccountId) batch.update(doc(db, 'users', userId, 'accounts', tx.fromAccountId), { balance: increment(tx.amount) });
      if (tx.toAccountId)   batch.update(doc(db, 'users', userId, 'accounts', tx.toAccountId),   { balance: increment(-tx.amount) });
    } else {
      // Reverse account balance for regular transactions
      if (tx.accountId) {
        const delta = tx.type === 'income' ? -tx.amount : tx.amount;
        batch.update(doc(db, 'users', userId, 'accounts', tx.accountId), { balance: increment(delta) });
      }
      // Reverse debt reduction
      if (tx.debtId) {
        batch.update(doc(db, 'users', userId, 'debts', tx.debtId), { currentBalance: increment(tx.amount) });
      }
      // Reverse asset cost basis
      if (tx.type === 'savings' && tx.assetId) {
        batch.update(doc(db, 'users', userId, 'assets', tx.assetId), {
          costBasis:    increment(-tx.amount),
          currentValue: increment(-tx.amount),
        });
      }
    }

    await batch.commit();
  }, [userId, transactions]);

  const addTransfer = useCallback(async ({ fromAccountId, toAccountId, amount, description, date }) => {
    const batch = writeBatch(db);

    const txRef = doc(collection(db, 'users', userId, 'transactions'));
    batch.set(txRef, {
      type:          'transfer',
      description:   description || 'Transfer',
      amount,
      fromAccountId,
      toAccountId,
      accountId:     fromAccountId,
      date,
    });

    batch.update(doc(db, 'users', userId, 'accounts', fromAccountId), { balance: increment(-amount) });
    batch.update(doc(db, 'users', userId, 'accounts', toAccountId),   { balance: increment(amount) });

    await batch.commit();
  }, [userId]);

  // ── Budgets ─────────────────────────────────────────────────────────────

  const upsertBudget = useCallback(async (budget) => {
    const safe  = s => s.replace(/[^\w]/g, '_');
    const docId = `${budget.type || 'expense'}_${safe(budget.category)}_${budget.month}`;
    await setDoc(doc(db, 'users', userId, 'budgets', docId), { type: 'expense', ...budget }, { merge: true });
  }, [userId]);

  const deleteBudget = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'budgets', id));
  }, [userId]);

  // ── Accounts ────────────────────────────────────────────────────────────

  const addAccount = useCallback(async (account) => {
    await addDoc(collection(db, 'users', userId, 'accounts'), account);
  }, [userId]);

  const updateAccount = useCallback(async (id, updates) => {
    await updateDoc(doc(db, 'users', userId, 'accounts', id), updates);
  }, [userId]);

  const deleteAccount = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'accounts', id));
  }, [userId]);

  // ── Debts ───────────────────────────────────────────────────────────────

  const addDebt = useCallback(async (debt) => {
    await addDoc(collection(db, 'users', userId, 'debts'), debt);
  }, [userId]);

  const updateDebt = useCallback(async (id, updates) => {
    await updateDoc(doc(db, 'users', userId, 'debts', id), updates);
  }, [userId]);

  const deleteDebt = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'debts', id));
  }, [userId]);

  // ── Assets ──────────────────────────────────────────────────────────────

  // Creates the asset record + an auto-generated savings transaction + deducts from source account
  const addAsset = useCallback(async (asset, sourceAccountId) => {
    const batch = writeBatch(db);

    const assetRef = doc(collection(db, 'users', userId, 'assets'));
    batch.set(assetRef, { ...asset, status: 'active' });

    if (sourceAccountId && asset.costBasis > 0) {
      const txRef = doc(collection(db, 'users', userId, 'transactions'));
      batch.set(txRef, {
        description: `Investment: ${asset.name}`,
        amount:      asset.costBasis,
        type:        'savings',
        category:    ASSET_TYPE_TO_CATEGORY[asset.assetType] || 'Others',
        date:        new Date().toISOString().slice(0, 10),
        accountId:   sourceAccountId,
        assetId:     assetRef.id,
      });
      batch.update(doc(db, 'users', userId, 'accounts', sourceAccountId), {
        balance: increment(-asset.costBasis),
      });
    }

    await batch.commit();
  }, [userId]);

  const updateAssetValue = useCallback(async (id, newValue) => {
    await updateDoc(doc(db, 'users', userId, 'assets', id), { currentValue: newValue });
  }, [userId]);

  // Cash out: marks asset done, creates income tx, credits target account
  const cashOutAsset = useCallback(async (id, receivedAmount, toAccountId) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    const batch = writeBatch(db);

    batch.update(doc(db, 'users', userId, 'assets', id), {
      status:         'cashed_out',
      cashedOutAmount: receivedAmount,
      cashedOutDate:   new Date().toISOString().slice(0, 10),
    });

    const txRef = doc(collection(db, 'users', userId, 'transactions'));
    batch.set(txRef, {
      description: `Cash out: ${asset.name}`,
      amount:      receivedAmount,
      type:        'income',
      category:    'Interest',
      date:        new Date().toISOString().slice(0, 10),
      accountId:   toAccountId,
      assetId:     id,
    });

    batch.update(doc(db, 'users', userId, 'accounts', toAccountId), {
      balance: increment(receivedAmount),
    });

    await batch.commit();
  }, [userId, assets]);

  const deleteAsset = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'assets', id));
  }, [userId]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getSpending = useCallback((month) => {
    const result = {};
    transactions
      .filter(t => t.date.startsWith(month) && t.type === 'expense')
      .forEach(t => { result[t.category] = (result[t.category] || 0) + t.amount; });
    return result;
  }, [transactions]);

  return {
    transactions, budgets, accounts, debts, assets, loading,
    addTransaction, deleteTransaction,
    upsertBudget, deleteBudget,
    addAccount, updateAccount, deleteAccount,
    addDebt, updateDebt, deleteDebt,
    addAsset, updateAssetValue, cashOutAsset, deleteAsset,
    getSpending,
  };
}
