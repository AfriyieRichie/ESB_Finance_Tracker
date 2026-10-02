import { useState, useEffect, useCallback } from 'react';
import { db, whenSaved } from '../firebase';
import {
  collection, doc, addDoc, deleteDoc, setDoc, onSnapshot,
  updateDoc, increment, writeBatch, deleteField,
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

// Onboarding choices: generic account kinds work anywhere (in the user's base currency);
// bank presets carry their own currency and are shown to users with that base currency.
export const GENERIC_ACCOUNTS = [
  { name: 'Bank Account',    type: 'bank',  color: '#3b82f6' },
  { name: 'Savings Account', type: 'bank',  color: '#14b8a6' },
  { name: 'Mobile Wallet',   type: 'momo',  color: '#eab308' },
  { name: 'Cash',            type: 'cash',  color: '#22c55e' },
  { name: 'Other',           type: 'other', color: '#6b7280' },
];

export const POPULAR_ACCOUNTS = [
  { name: 'GCB Bank',     type: 'bank',  color: '#e41e20', currency: 'GHS' },
  { name: 'Absa',         type: 'bank',  color: '#b31012', currency: 'GHS' },
  { name: 'Ecobank',      type: 'bank',  color: '#0072bc', currency: 'GHS' },
  { name: 'Fidelity',     type: 'bank',  color: '#4f46e5', currency: 'GHS' },
  { name: 'Stanbic',      type: 'bank',  color: '#0ea5e9', currency: 'GHS' },
  { name: 'Cal Bank',     type: 'bank',  color: '#7c3aed', currency: 'GHS' },
  { name: 'MTN MoMo',     type: 'momo',  color: '#eab308', currency: 'GHS' },
  { name: 'Telecel Cash', type: 'momo',  color: '#dc2626', currency: 'GHS' },
  { name: 'AirtelTigo',   type: 'momo',  color: '#f97316', currency: 'GHS' },
  { name: 'Monzo',        type: 'bank',  color: '#ff4f40', currency: 'GBP' },
  { name: 'Revolut',      type: 'bank',  color: '#0666eb', currency: 'GBP' },
  { name: 'Barclays',     type: 'bank',  color: '#00aeef', currency: 'GBP' },
  { name: 'HSBC UK',      type: 'bank',  color: '#db0011', currency: 'GBP' },
  { name: 'Lloyds',       type: 'bank',  color: '#006a4d', currency: 'GBP' },
  { name: 'Nationwide',   type: 'bank',  color: '#1d1d6b', currency: 'GBP' },
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

// Amounts linked to a debt/asset are stored in that debt's/asset's currency when it differs
// from the paying account's (debtAmount / assetAmount); otherwise the tx amount applies.
const debtAmt  = t => t.debtAmount  ?? t.amount;
const assetAmt = t => t.assetAmount ?? t.amount;

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useFinanceData(userId) {
  const [transactions, setTransactions] = useState([]);
  const [budgets,      setBudgets]      = useState([]);
  const [accounts,     setAccounts]     = useState([]);
  const [debts,        setDebts]        = useState([]);
  const [assets,       setAssets]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  // True once the server (not just the offline cache) has confirmed the accounts list
  const [accountsConfirmed, setAccountsConfirmed] = useState(false);

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
      { includeMetadataChanges: true },
      snap => {
        setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        if (!snap.metadata.fromCache) setAccountsConfirmed(true);
        loaded.accounts = true; checkDone();
      }
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
      batch.update(doc(db, 'users', userId, 'debts', t.debtId), { currentBalance: increment(-debtAmt(t)) });
    }

    // If savings linked to an asset, increase cost basis
    if (t.type === 'savings' && t.assetId) {
      batch.update(doc(db, 'users', userId, 'assets', t.assetId), {
        costBasis:    increment(assetAmt(t)),
        currentValue: increment(assetAmt(t)),
      });
    }

    await whenSaved(batch.commit());
  }, [userId]);

  const deleteTransaction = useCallback(async (id) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId, 'transactions', id));

    if (tx.type === 'transfer') {
      // Reverse both sides of the transfer
      if (tx.fromAccountId) batch.update(doc(db, 'users', userId, 'accounts', tx.fromAccountId), { balance: increment(tx.amount) });
      if (tx.toAccountId)   batch.update(doc(db, 'users', userId, 'accounts', tx.toAccountId),   { balance: increment(-(tx.toAmount ?? tx.amount)) });
    } else {
      // Reverse account balance for regular transactions
      if (tx.accountId) {
        const delta = tx.type === 'income' ? -tx.amount : tx.amount;
        batch.update(doc(db, 'users', userId, 'accounts', tx.accountId), { balance: increment(delta) });
      }
      // Reverse debt reduction
      if (tx.debtId) {
        batch.update(doc(db, 'users', userId, 'debts', tx.debtId), { currentBalance: increment(debtAmt(tx)) });
      }
      // Reverse asset cost basis
      if (tx.type === 'savings' && tx.assetId) {
        batch.update(doc(db, 'users', userId, 'assets', tx.assetId), {
          costBasis:    increment(-assetAmt(tx)),
          currentValue: increment(-assetAmt(tx)),
        });
      }
    }

    await whenSaved(batch.commit());
  }, [userId, transactions]);

  // amount is in the source account's currency; toAmount (if given) is what arrived in the
  // destination account's currency, so cross-currency transfers record the real rate incl. fees
  const addTransfer = useCallback(async ({ fromAccountId, toAccountId, amount, toAmount, description, date, ...meta }) => {
    const batch = writeBatch(db);
    const received = toAmount ?? amount;

    const txRef = doc(collection(db, 'users', userId, 'transactions'));
    batch.set(txRef, {
      ...meta,
      type:          'transfer',
      description:   description || 'Transfer',
      amount,
      toAmount:      received,
      fromAccountId,
      toAccountId,
      accountId:     fromAccountId,
      date,
    });

    batch.update(doc(db, 'users', userId, 'accounts', fromAccountId), { balance: increment(-amount) });
    batch.update(doc(db, 'users', userId, 'accounts', toAccountId),   { balance: increment(received) });

    await whenSaved(batch.commit());
  }, [userId]);

  // ── Budgets ─────────────────────────────────────────────────────────────

  const upsertBudget = useCallback(async (budget) => {
    const safe  = s => s.replace(/[^\w]/g, '_');
    const docId = `${budget.type || 'expense'}_${safe(budget.category)}_${budget.month}`;
    await whenSaved(setDoc(doc(db, 'users', userId, 'budgets', docId), { type: 'expense', ...budget }, { merge: true }));
  }, [userId]);

  const deleteBudget = useCallback(async (id) => {
    await whenSaved(deleteDoc(doc(db, 'users', userId, 'budgets', id)));
  }, [userId]);

  // ── Accounts ────────────────────────────────────────────────────────────

  const addAccount = useCallback(async (account) => {
    await whenSaved(addDoc(collection(db, 'users', userId, 'accounts'), account));
  }, [userId]);

  const updateAccount = useCallback(async (id, updates) => {
    await whenSaved(updateDoc(doc(db, 'users', userId, 'accounts', id), updates));
  }, [userId]);

  const deleteAccount = useCallback(async (id) => {
    await whenSaved(deleteDoc(doc(db, 'users', userId, 'accounts', id)));
  }, [userId]);

  // ── Debts ───────────────────────────────────────────────────────────────

  const addDebt = useCallback(async (debt) => {
    await whenSaved(addDoc(collection(db, 'users', userId, 'debts'), debt));
  }, [userId]);

  const updateDebt = useCallback(async (id, updates) => {
    await whenSaved(updateDoc(doc(db, 'users', userId, 'debts', id), updates));
  }, [userId]);

  const deleteDebt = useCallback(async (id) => {
    await whenSaved(deleteDoc(doc(db, 'users', userId, 'debts', id)));
  }, [userId]);

  // ── Assets ──────────────────────────────────────────────────────────────

  // Creates the asset record + an auto-generated savings transaction + deducts from source account.
  // sourceAmount is the cost in the source account's currency (defaults to costBasis); txMeta adds
  // currency/fxRate fields to the generated transaction.
  const addAsset = useCallback(async (asset, sourceAccountId, sourceAmount, txMeta = {}) => {
    const batch = writeBatch(db);

    const assetRef = doc(collection(db, 'users', userId, 'assets'));
    batch.set(assetRef, { ...asset, status: 'active' });

    if (sourceAccountId && asset.costBasis > 0) {
      const txRef = doc(collection(db, 'users', userId, 'transactions'));
      const paid  = sourceAmount ?? asset.costBasis;
      batch.set(txRef, {
        ...txMeta,
        description: `Investment: ${asset.name}`,
        amount:      paid,
        assetAmount: asset.costBasis,
        type:        'savings',
        category:    ASSET_TYPE_TO_CATEGORY[asset.assetType] || 'Others',
        date:        new Date().toISOString().slice(0, 10),
        accountId:   sourceAccountId,
        assetId:     assetRef.id,
      });
      batch.update(doc(db, 'users', userId, 'accounts', sourceAccountId), {
        balance: increment(-paid),
      });
    }

    await whenSaved(batch.commit());
  }, [userId]);

  const updateAsset = useCallback(async (id, updates) => {
    await whenSaved(updateDoc(doc(db, 'users', userId, 'assets', id), updates));
  }, [userId]);

  const updateAssetValue = useCallback(async (id, newValue) => {
    await whenSaved(updateDoc(doc(db, 'users', userId, 'assets', id), { currentValue: newValue }));
  }, [userId]);

  // Cash out: marks asset done, creates income tx, credits target account
  const cashOutAsset = useCallback(async (id, receivedAmount, toAccountId, txMeta = {}) => {
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
      ...txMeta,
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

    await whenSaved(batch.commit());
  }, [userId, assets]);

  const deleteAsset = useCallback(async (id) => {
    await whenSaved(deleteDoc(doc(db, 'users', userId, 'assets', id)));
  }, [userId]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getSpending = useCallback((month) => {
    const result = {};
    transactions
      .filter(t => t.date.startsWith(month) && t.type === 'expense')
      .forEach(t => { result[t.category] = (result[t.category] || 0) + t.amount; });
    return result;
  }, [transactions]);

  // ── Update transaction (edit) ────────────────────────────────────────────

  const updateTransaction = useCallback(async (original, updates) => {
    const batch = writeBatch(db);

    // Remove links (and their converted amounts) that the edit dropped
    const writeUpdates = { ...updates };
    ['debtId', 'assetId', 'debtAmount', 'assetAmount'].forEach(k => {
      if (original[k] !== undefined && updates[k] === undefined) writeUpdates[k] = deleteField();
    });
    batch.update(doc(db, 'users', userId, 'transactions', original.id), writeUpdates);

    if (original.type !== 'transfer') {
      const oldAccId = original.accountId;
      const newAccId = updates.accountId || original.accountId;
      const oldAmt   = original.amount;
      const newAmt   = updates.amount !== undefined ? updates.amount : original.amount;
      const oldType  = original.type;
      const newType  = updates.type || original.type;

      const effect = (type, amt) => type === 'income' ? amt : -amt;

      if (oldAccId === newAccId) {
        const delta = effect(newType, newAmt) - effect(oldType, oldAmt);
        if (delta !== 0)
          batch.update(doc(db, 'users', userId, 'accounts', oldAccId), { balance: increment(delta) });
      } else {
        batch.update(doc(db, 'users', userId, 'accounts', oldAccId), { balance: increment(-effect(oldType, oldAmt)) });
        batch.update(doc(db, 'users', userId, 'accounts', newAccId), { balance: increment(effect(newType, newAmt)) });
      }

      // Debt adjustment (amounts in the debt's currency)
      const oldDebt = debtAmt(original);
      const newDebt = updates.debtAmount ?? newAmt;
      if (original.debtId && original.debtId !== updates.debtId)
        batch.update(doc(db, 'users', userId, 'debts', original.debtId), { currentBalance: increment(oldDebt) });
      if (updates.debtId && updates.debtId !== original.debtId)
        batch.update(doc(db, 'users', userId, 'debts', updates.debtId), { currentBalance: increment(-newDebt) });
      else if (updates.debtId && updates.debtId === original.debtId && newDebt !== oldDebt)
        batch.update(doc(db, 'users', userId, 'debts', updates.debtId), { currentBalance: increment(oldDebt - newDebt) });

      // Asset adjustment (savings linked to asset, amounts in the asset's currency)
      const oldAsset = assetAmt(original);
      const newAsset = updates.assetAmount ?? newAmt;
      if (original.assetId && original.assetId !== updates.assetId)
        batch.update(doc(db, 'users', userId, 'assets', original.assetId), { currentValue: increment(-oldAsset), costBasis: increment(-oldAsset) });
      if (updates.assetId && updates.assetId !== original.assetId)
        batch.update(doc(db, 'users', userId, 'assets', updates.assetId), { currentValue: increment(newAsset), costBasis: increment(newAsset) });
      else if (updates.assetId && updates.assetId === original.assetId && newAsset !== oldAsset)
        batch.update(doc(db, 'users', userId, 'assets', updates.assetId), { currentValue: increment(newAsset - oldAsset), costBasis: increment(newAsset - oldAsset) });
    }

    await whenSaved(batch.commit());
  }, [userId]);

  return {
    transactions, budgets, accounts, debts, assets, loading, accountsConfirmed,
    addTransaction, updateTransaction, deleteTransaction,
    addTransfer,
    upsertBudget, deleteBudget,
    addAccount, updateAccount, deleteAccount,
    addDebt, updateDebt, deleteDebt,
    addAsset, updateAsset, updateAssetValue, cashOutAsset, deleteAsset,
    getSpending,
  };
}
