import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, doc, addDoc, deleteDoc, setDoc, onSnapshot,
} from 'firebase/firestore';

// ─── Category Definitions ──────────────────────────────────────────────────

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
  { name: 'Other',          icon: '📦', color: '#7db896' },
];

export const INCOME_CATEGORIES = [
  { name: 'Salary',         icon: '💼', color: '#00e676' },
  { name: 'Dividend',       icon: '📈', color: '#2affa0' },
  { name: 'Interest',       icon: '🏦', color: '#4ade80' },
  { name: 'Business',       icon: '🏢', color: '#06b6d4' },
  { name: 'Freelance',      icon: '💻', color: '#34d399' },
  { name: 'Rental',         icon: '🏡', color: '#00b85a' },
  { name: 'Others',         icon: '📦', color: '#7db896' },
];

export const SAVINGS_CATEGORIES = [
  { name: 'Emergency Fund', icon: '🛡️', color: '#00e676' },
  { name: 'Stock Portfolio',icon: '📊', color: '#2affa0' },
  { name: 'Pension Fund',   icon: '👴', color: '#06b6d4' },
  { name: 'Fixed Deposit',  icon: '🏦', color: '#4ade80' },
  { name: 'Cryptocurrency', icon: '₿',  color: '#34d399' },
  { name: 'Real Estate',    icon: '🏡', color: '#00b85a' },
  { name: 'Mutual Funds',   icon: '💹', color: '#6ee7b7' },
  { name: 'Others',         icon: '💰', color: '#7db896' },
];

export const CATEGORIES    = EXPENSE_CATEGORIES;
export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SAVINGS_CATEGORIES];

export function getCategoriesForType(type) {
  if (type === 'income')  return INCOME_CATEGORIES;
  if (type === 'savings') return SAVINGS_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

export function getCategoryInfo(name) {
  return ALL_CATEGORIES.find(c => c.name === name) ?? { name, icon: '📦', color: '#94a3b8' };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useFinanceData(userId) {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets]           = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!userId) return;

    let txLoaded = false;
    let budgetLoaded = false;
    const checkDone = () => { if (txLoaded && budgetLoaded) setLoading(false); };

    const unsubTx = onSnapshot(
      collection(db, 'users', userId, 'transactions'),
      snapshot => {
        setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        txLoaded = true;
        checkDone();
      }
    );

    const unsubBudgets = onSnapshot(
      collection(db, 'users', userId, 'budgets'),
      snapshot => {
        setBudgets(snapshot.docs.map(d => ({ type: 'expense', ...d.data(), id: d.id })));
        budgetLoaded = true;
        checkDone();
      }
    );

    return () => { unsubTx(); unsubBudgets(); };
  }, [userId]);

  const addTransaction = useCallback(async (t) => {
    await addDoc(collection(db, 'users', userId, 'transactions'), t);
  }, [userId]);

  const deleteTransaction = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'transactions', id));
  }, [userId]);

  // Use a deterministic document ID so setDoc acts as upsert
  const upsertBudget = useCallback(async (budget) => {
    const safe  = (s) => s.replace(/[^\w]/g, '_');
    const docId = `${budget.type || 'expense'}_${safe(budget.category)}_${budget.month}`;
    await setDoc(
      doc(db, 'users', userId, 'budgets', docId),
      { type: 'expense', ...budget },
      { merge: true }
    );
  }, [userId]);

  const deleteBudget = useCallback(async (id) => {
    await deleteDoc(doc(db, 'users', userId, 'budgets', id));
  }, [userId]);

  const getSpending = useCallback((month) => {
    const result = {};
    transactions
      .filter(t => t.date.startsWith(month) && t.type === 'expense')
      .forEach(t => { result[t.category] = (result[t.category] || 0) + t.amount; });
    return result;
  }, [transactions]);

  return { transactions, budgets, loading, addTransaction, deleteTransaction, upsertBudget, deleteBudget, getSpending };
}
