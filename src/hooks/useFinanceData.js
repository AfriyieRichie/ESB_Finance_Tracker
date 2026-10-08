import { useState, useEffect, useCallback } from 'react';
import { db, whenSaved } from '../firebase';
import { DEMO, demoData } from '../demo';
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

// Business categories: used for transactions tagged to a project (kept apart from personal ones)
export const BUSINESS_EXPENSE_CATEGORIES = [
  { name: 'Equipment',                 icon: '💻', color: '#3b82f6' },
  { name: 'Stock / Inventory',         icon: '📦', color: '#f59e0b' },
  { name: 'Marketing & Ads',           icon: '📣', color: '#ec4899' },
  { name: 'Software & Subscriptions',  icon: '🧩', color: '#8b5cf6' },
  { name: 'Registration & Licences',   icon: '📄', color: '#14b8a6' },
  { name: 'Professional Fees',         icon: '⚖️', color: '#06b6d4' },
  { name: 'Rent & Workspace',          icon: '🏢', color: '#22c55e' },
  { name: 'Business Travel',           icon: '✈️', color: '#0ea5e9' },
  { name: 'Other Business Costs',      icon: '🧾', color: '#6b7280' },
];
export const BUSINESS_INCOME_CATEGORIES = [
  { name: 'Sales',                     icon: '🛒', color: '#00e676' },
  { name: 'Services / Client Payments',icon: '🤝', color: '#2affa0' },
  { name: 'Other Business Income',     icon: '💷', color: '#7db896' },
];

export const CATEGORIES     = EXPENSE_CATEGORIES;
export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SAVINGS_CATEGORIES,
  ...BUSINESS_EXPENSE_CATEGORIES, ...BUSINESS_INCOME_CATEGORIES];

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
// Money coming into an account: income, or cash received from a new loan ('loan', not income)
const isInflow = t => t.type === 'income' || t.type === 'loan';
const assetAmt = t => t.assetAmount ?? t.amount;

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useFinanceData(userId) {
  const [demo]                          = useState(() => (DEMO ? demoData() : null));
  const [transactions, setTransactions] = useState(demo?.transactions || []);
  const [budgets,      setBudgets]      = useState(demo?.budgets || []);
  const [accounts,     setAccounts]     = useState(demo?.accounts || []);
  const [debts,        setDebts]        = useState(demo?.debts || []);
  const [assets,       setAssets]       = useState(demo?.assets || []);
  const [projects,     setProjects]     = useState(demo?.projects || []);
  const [loading,      setLoading]      = useState(!demo);
  // True once the server (not just the offline cache) has confirmed the accounts list
  const [accountsConfirmed, setAccountsConfirmed] = useState(!!demo);
  // 'error' if a listener failed (with its code), 'slow' if loading passed the time limit
  const [loadIssue, setLoadIssue] = useState(null);

  useEffect(() => {
    if (!userId || DEMO) return;

    const loaded = { tx: false, budgets: false, accounts: false, debts: false, assets: false, projects: false };
    const checkDone = () => { if (Object.values(loaded).every(Boolean)) { clearTimeout(slowTimer); setLoading(false); } };

    // A failed listener must still count as "done", otherwise the spinner never stops
    const listen = (key, name, opts, onData) => onSnapshot(
      collection(db, 'users', userId, name), opts,
      snap => { onData(snap); loaded[key] = true; checkDone(); },
      err => {
        console.error(`Loading ${name} failed:`, err);
        setLoadIssue({ kind: 'error', code: err.code || 'unknown', what: name });
        loaded[key] = true; checkDone();
      }
    );

    // Slow or blocked connection: show what we have instead of waiting forever
    const slowTimer = setTimeout(() => {
      if (!Object.values(loaded).every(Boolean)) {
        setLoadIssue(prev => prev || { kind: 'slow' });
        setLoading(false);
      }
    }, 12000);

    const unsubTx = listen('tx', 'transactions', {},
      snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubBudgets = listen('budgets', 'budgets', {},
      snap => setBudgets(snap.docs.map(d => ({ type: 'expense', ...d.data(), id: d.id }))));
    const unsubAccounts = listen('accounts', 'accounts', { includeMetadataChanges: true }, snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (!snap.metadata.fromCache) setAccountsConfirmed(true);
    });
    const unsubDebts = listen('debts', 'debts', {},
      snap => setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubAssets = listen('assets', 'assets', {},
      snap => setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const unsubProjects = listen('projects', 'projects', {},
      snap => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { clearTimeout(slowTimer); unsubTx(); unsubBudgets(); unsubAccounts(); unsubDebts(); unsubAssets(); unsubProjects(); };
  }, [userId]);

  // ── Transactions ────────────────────────────────────────────────────────

  const addTransaction = useCallback(async (t) => {
    const batch = writeBatch(db);

    // Write transaction
    const txRef = doc(collection(db, 'users', userId, 'transactions'));
    batch.set(txRef, { ...t, loggedAt: t.loggedAt ?? Date.now() });   // keeps same-day order

    // Update account balance
    const delta = isInflow(t) ? t.amount : -t.amount;
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
        const delta = isInflow(tx) ? -tx.amount : tx.amount;
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
      loggedAt: Date.now(),
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

  // Cash received from a loan: credits the account and records a 'loan' transaction (not income,
  // so it stays out of income totals and budgets). receipt = { accountId, amount, date, fx }
  const writeLoanReceipt = useCallback((batch, debtId, debtName, receipt) => {
    const txRef = doc(collection(db, 'users', userId, 'transactions'));
    batch.set(txRef, {
      loggedAt: Date.now(),
      ...(receipt.fx || {}),
      type:        'loan',
      description: `Loan received: ${debtName}`,
      amount:      receipt.amount,
      category:    'Loan received',
      date:        receipt.date,
      accountId:   receipt.accountId,
      loanDebtId:  debtId,
    });
    batch.update(doc(db, 'users', userId, 'accounts', receipt.accountId), { balance: increment(receipt.amount) });
  }, [userId]);

  const addDebt = useCallback(async (debt, receipt) => {
    if (!receipt) {
      await whenSaved(addDoc(collection(db, 'users', userId, 'debts'), debt));
      return;
    }
    const batch   = writeBatch(db);
    const debtRef = doc(collection(db, 'users', userId, 'debts'));
    batch.set(debtRef, debt);
    writeLoanReceipt(batch, debtRef.id, debt.name, receipt);
    await whenSaved(batch.commit());
  }, [userId, writeLoanReceipt]);

  // Record the cash-in for a loan that was added earlier
  const recordLoanReceipt = useCallback(async (debt, receipt) => {
    const batch = writeBatch(db);
    writeLoanReceipt(batch, debt.id, debt.name, receipt);
    await whenSaved(batch.commit());
  }, [writeLoanReceipt]);

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
      loggedAt: Date.now(),
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
      loggedAt: Date.now(),
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

  // ── Projects ────────────────────────────────────────────────────────────

  const addProject = useCallback(async (project) => {
    await whenSaved(addDoc(collection(db, 'users', userId, 'projects'), { status: 'active', ...project }));
  }, [userId]);

  const updateProject = useCallback(async (id, updates) => {
    await whenSaved(updateDoc(doc(db, 'users', userId, 'projects', id), updates));
  }, [userId]);

  // Deleting a project keeps its transactions (they stay in your accounts) but un-tags them,
  // so they count as personal again. Batches stay under Firestore's 500-write limit.
  const deleteProject = useCallback(async (id) => {
    const tagged = transactions.filter(t => t.projectId === id);
    const refs = [doc(db, 'users', userId, 'projects', id)];
    for (let i = 0; i <= tagged.length; i += 450) {
      const batch = writeBatch(db);
      if (i === 0) batch.delete(refs[0]);
      tagged.slice(i, i + 450).forEach(t =>
        batch.update(doc(db, 'users', userId, 'transactions', t.id), { projectId: deleteField() }));
      await whenSaved(batch.commit());
    }
  }, [userId, transactions]);

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
    ['debtId', 'assetId', 'debtAmount', 'assetAmount', 'projectId'].forEach(k => {
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

      const effect = (type, amt) => (type === 'income' || type === 'loan') ? amt : -amt;

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
    transactions, budgets, accounts, debts, assets, projects, loading, accountsConfirmed, loadIssue,
    addTransaction, updateTransaction, deleteTransaction,
    addTransfer,
    upsertBudget, deleteBudget,
    addAccount, updateAccount, deleteAccount,
    addDebt, updateDebt, deleteDebt, recordLoanReceipt,
    addAsset, updateAsset, updateAssetValue, cashOutAsset, deleteAsset,
    addProject, updateProject, deleteProject,
    getSpending,
  };
}
