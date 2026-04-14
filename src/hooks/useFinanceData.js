import { useState, useEffect, useCallback } from 'react';

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

// Backward-compat alias used by Budget (expense-only budgets)
export const CATEGORIES = EXPENSE_CATEGORIES;

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SAVINGS_CATEGORIES];

export function getCategoriesForType(type) {
  if (type === 'income')  return INCOME_CATEGORIES;
  if (type === 'savings') return SAVINGS_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

export function getCategoryInfo(name) {
  return ALL_CATEGORIES.find(c => c.name === name) ?? { name, icon: '📦', color: '#94a3b8' };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).substr(2, 9);

// ─── Sample Data ───────────────────────────────────────────────────────────

const SAMPLE_TRANSACTIONS = [
  // ── April 2026 ──────────────────────────────────────────────────────────
  { id: 'a01', description: 'Monthly Salary',       amount: 5000,   type: 'income',  category: 'Salary',         date: '2026-04-01' },
  { id: 'a02', description: 'Dividend – MTN',       amount: 320,    type: 'income',  category: 'Dividend',       date: '2026-04-03' },
  { id: 'a03', description: 'Rent Payment',         amount: 1500,   type: 'expense', category: 'Housing',        date: '2026-04-02' },
  { id: 'a04', description: 'Grocery Shopping',     amount: 145,    type: 'expense', category: 'Food & Dining',  date: '2026-04-03' },
  { id: 'a05', description: 'Netflix',              amount: 55,     type: 'expense', category: 'Entertainment',  date: '2026-04-04' },
  { id: 'a06', description: 'Fuel – Petrol',        amount: 65,     type: 'expense', category: 'Transportation', date: '2026-04-05' },
  { id: 'a07', description: 'Restaurant Dinner',    amount: 78,     type: 'expense', category: 'Food & Dining',  date: '2026-04-07' },
  { id: 'a08', description: 'Electricity Bill',     amount: 95,     type: 'expense', category: 'Utilities',      date: '2026-04-08' },
  { id: 'a09', description: 'Online Shopping',      amount: 120,    type: 'expense', category: 'Shopping',       date: '2026-04-09' },
  { id: 'a10', description: 'Doctor Visit',         amount: 80,     type: 'expense', category: 'Healthcare',     date: '2026-04-10' },
  { id: 'a11', description: 'Coffee Shop',          amount: 22,     type: 'expense', category: 'Food & Dining',  date: '2026-04-11' },
  { id: 'a12', description: 'Uber Rides',           amount: 35,     type: 'expense', category: 'Transportation', date: '2026-04-12' },
  { id: 'a13', description: 'Gym Membership',       amount: 45,     type: 'expense', category: 'Personal Care',  date: '2026-04-13' },
  { id: 'a14', description: 'Takeout Lunch',        amount: 18,     type: 'expense', category: 'Food & Dining',  date: '2026-04-14' },
  { id: 'a15', description: 'Emergency Fund',       amount: 500,    type: 'savings', category: 'Emergency Fund', date: '2026-04-01' },
  { id: 'a16', description: 'Stock Purchase – GCB', amount: 300,    type: 'savings', category: 'Stock Portfolio',date: '2026-04-05' },
  // ── March 2026 ──────────────────────────────────────────────────────────
  { id: 'b01', description: 'Monthly Salary',       amount: 5000,   type: 'income',  category: 'Salary',         date: '2026-03-01' },
  { id: 'b02', description: 'Freelance Project',    amount: 800,    type: 'income',  category: 'Freelance',      date: '2026-03-25' },
  { id: 'b03', description: 'Rent Payment',         amount: 1500,   type: 'expense', category: 'Housing',        date: '2026-03-02' },
  { id: 'b04', description: 'Grocery Shopping',     amount: 210,    type: 'expense', category: 'Food & Dining',  date: '2026-03-04' },
  { id: 'b05', description: 'Movie Night',          amount: 40,     type: 'expense', category: 'Entertainment',  date: '2026-03-06' },
  { id: 'b06', description: 'Fuel – Petrol',        amount: 70,     type: 'expense', category: 'Transportation', date: '2026-03-08' },
  { id: 'b07', description: 'Internet Bill',        amount: 60,     type: 'expense', category: 'Utilities',      date: '2026-03-10' },
  { id: 'b08', description: 'Amazon Purchase',      amount: 89,     type: 'expense', category: 'Shopping',       date: '2026-03-12' },
  { id: 'b09', description: 'Restaurant Lunch',     amount: 45,     type: 'expense', category: 'Food & Dining',  date: '2026-03-15' },
  { id: 'b10', description: 'Pharmacy',             amount: 30,     type: 'expense', category: 'Healthcare',     date: '2026-03-17' },
  { id: 'b11', description: 'Online Course',        amount: 49,     type: 'expense', category: 'Education',      date: '2026-03-20' },
  { id: 'b12', description: 'Haircut',              amount: 35,     type: 'expense', category: 'Personal Care',  date: '2026-03-22' },
  { id: 'b13', description: 'Coffee & Snacks',      amount: 28,     type: 'expense', category: 'Food & Dining',  date: '2026-03-28' },
  { id: 'b14', description: 'Emergency Fund',       amount: 500,    type: 'savings', category: 'Emergency Fund', date: '2026-03-01' },
  { id: 'b15', description: 'Fixed Deposit – GCB',  amount: 1000,   type: 'savings', category: 'Fixed Deposit',  date: '2026-03-03' },
  // ── February 2026 ───────────────────────────────────────────────────────
  { id: 'c01', description: 'Monthly Salary',       amount: 5000,   type: 'income',  category: 'Salary',         date: '2026-02-01' },
  { id: 'c02', description: 'Freelance Project',    amount: 600,    type: 'income',  category: 'Freelance',      date: '2026-02-22' },
  { id: 'c03', description: 'Interest – Savings A/C',amount: 120,   type: 'income',  category: 'Interest',       date: '2026-02-28' },
  { id: 'c04', description: 'Rent Payment',         amount: 1500,   type: 'expense', category: 'Housing',        date: '2026-02-02' },
  { id: 'c05', description: 'Grocery Shopping',     amount: 195,    type: 'expense', category: 'Food & Dining',  date: '2026-02-05' },
  { id: 'c06', description: "Valentine's Dinner",   amount: 150,    type: 'expense', category: 'Food & Dining',  date: '2026-02-14' },
  { id: 'c07', description: 'Fuel – Petrol',        amount: 55,     type: 'expense', category: 'Transportation', date: '2026-02-07' },
  { id: 'c08', description: 'Spotify',              amount: 30,     type: 'expense', category: 'Entertainment',  date: '2026-02-08' },
  { id: 'c09', description: 'Water Bill',           amount: 45,     type: 'expense', category: 'Utilities',      date: '2026-02-10' },
  { id: 'c10', description: 'Clothing Store',       amount: 180,    type: 'expense', category: 'Shopping',       date: '2026-02-12' },
  { id: 'c11', description: 'Dental Checkup',       amount: 120,    type: 'expense', category: 'Healthcare',     date: '2026-02-18' },
  { id: 'c12', description: 'Books',                amount: 55,     type: 'expense', category: 'Education',      date: '2026-02-20' },
  { id: 'c13', description: 'Emergency Fund',       amount: 500,    type: 'savings', category: 'Emergency Fund', date: '2026-02-01' },
  { id: 'c14', description: 'Stocks – Databank',    amount: 400,    type: 'savings', category: 'Stock Portfolio',date: '2026-02-10' },
  // ── January 2026 ────────────────────────────────────────────────────────
  { id: 'd01', description: 'Monthly Salary',       amount: 5000,   type: 'income',  category: 'Salary',         date: '2026-01-01' },
  { id: 'd02', description: 'Bonus',                amount: 1500,   type: 'income',  category: 'Salary',         date: '2026-01-15' },
  { id: 'd03', description: 'Rent Payment',         amount: 1500,   type: 'expense', category: 'Housing',        date: '2026-01-02' },
  { id: 'd04', description: 'Grocery Shopping',     amount: 225,    type: 'expense', category: 'Food & Dining',  date: '2026-01-05' },
  { id: 'd05', description: 'Netflix & Showmax',    amount: 80,     type: 'expense', category: 'Entertainment',  date: '2026-01-08' },
  { id: 'd06', description: 'Fuel – Petrol',        amount: 80,     type: 'expense', category: 'Transportation', date: '2026-01-10' },
  { id: 'd07', description: 'Electric Bill',        amount: 110,    type: 'expense', category: 'Utilities',      date: '2026-01-12' },
  { id: 'd08', description: 'New Year Shopping',    amount: 250,    type: 'expense', category: 'Shopping',       date: '2026-01-03' },
  { id: 'd09', description: 'Restaurant',           amount: 65,     type: 'expense', category: 'Food & Dining',  date: '2026-01-18' },
  { id: 'd10', description: 'Pharmacy',             amount: 25,     type: 'expense', category: 'Healthcare',     date: '2026-01-20' },
  { id: 'd11', description: 'Emergency Fund',       amount: 500,    type: 'savings', category: 'Emergency Fund', date: '2026-01-01' },
  { id: 'd12', description: 'Pension Contribution', amount: 600,    type: 'savings', category: 'Pension Fund',   date: '2026-01-05' },
  // ── December 2025 ───────────────────────────────────────────────────────
  { id: 'e01', description: 'Monthly Salary',       amount: 5000,   type: 'income',  category: 'Salary',         date: '2025-12-01' },
  { id: 'e02', description: 'Year-end Bonus',       amount: 2000,   type: 'income',  category: 'Salary',         date: '2025-12-20' },
  { id: 'e03', description: 'Dividend – CAL Bank',  amount: 210,    type: 'income',  category: 'Dividend',       date: '2025-12-15' },
  { id: 'e04', description: 'Rent Payment',         amount: 1500,   type: 'expense', category: 'Housing',        date: '2025-12-02' },
  { id: 'e05', description: 'Christmas Shopping',   amount: 450,    type: 'expense', category: 'Shopping',       date: '2025-12-10' },
  { id: 'e06', description: 'Grocery Shopping',     amount: 280,    type: 'expense', category: 'Food & Dining',  date: '2025-12-05' },
  { id: 'e07', description: 'Holiday Dinner',       amount: 200,    type: 'expense', category: 'Food & Dining',  date: '2025-12-25' },
  { id: 'e08', description: 'Fuel – Petrol',        amount: 75,     type: 'expense', category: 'Transportation', date: '2025-12-08' },
  { id: 'e09', description: 'Electric & Water',     amount: 130,    type: 'expense', category: 'Utilities',      date: '2025-12-12' },
  { id: 'e10', description: 'Mutual Fund – SIC',    amount: 800,    type: 'savings', category: 'Mutual Funds',   date: '2025-12-03' },
  { id: 'e11', description: 'Emergency Fund',       amount: 500,    type: 'savings', category: 'Emergency Fund', date: '2025-12-01' },
  // ── November 2025 ───────────────────────────────────────────────────────
  { id: 'f01', description: 'Monthly Salary',       amount: 5000,   type: 'income',  category: 'Salary',         date: '2025-11-01' },
  { id: 'f02', description: 'Freelance Project',    amount: 1200,   type: 'income',  category: 'Freelance',      date: '2025-11-20' },
  { id: 'f03', description: 'Interest – FD',        amount: 180,    type: 'income',  category: 'Interest',       date: '2025-11-30' },
  { id: 'f04', description: 'Rent Payment',         amount: 1500,   type: 'expense', category: 'Housing',        date: '2025-11-02' },
  { id: 'f05', description: 'Black Friday Deals',   amount: 320,    type: 'expense', category: 'Shopping',       date: '2025-11-28' },
  { id: 'f06', description: 'Grocery Shopping',     amount: 190,    type: 'expense', category: 'Food & Dining',  date: '2025-11-05' },
  { id: 'f07', description: 'Fuel – Petrol',        amount: 65,     type: 'expense', category: 'Transportation', date: '2025-11-08' },
  { id: 'f08', description: 'Internet & Phone',     amount: 100,    type: 'expense', category: 'Utilities',      date: '2025-11-10' },
  { id: 'f09', description: 'Gym + Spa',            amount: 80,     type: 'expense', category: 'Personal Care',  date: '2025-11-15' },
  { id: 'f10', description: 'Stock Purchase – GCB', amount: 600,    type: 'savings', category: 'Stock Portfolio',date: '2025-11-05' },
  { id: 'f11', description: 'Emergency Fund',       amount: 500,    type: 'savings', category: 'Emergency Fund', date: '2025-11-01' },
];

const SAMPLE_BUDGETS = [
  { id: 'bg1',  category: 'Housing',        amount: 1600, month: '2026-04' },
  { id: 'bg2',  category: 'Food & Dining',  amount: 500,  month: '2026-04' },
  { id: 'bg3',  category: 'Transportation', amount: 200,  month: '2026-04' },
  { id: 'bg4',  category: 'Entertainment',  amount: 150,  month: '2026-04' },
  { id: 'bg5',  category: 'Healthcare',     amount: 100,  month: '2026-04' },
  { id: 'bg6',  category: 'Shopping',       amount: 300,  month: '2026-04' },
  { id: 'bg7',  category: 'Utilities',      amount: 150,  month: '2026-04' },
  { id: 'bg8',  category: 'Education',      amount: 100,  month: '2026-04' },
  { id: 'bg9',  category: 'Personal Care',  amount: 100,  month: '2026-04' },
  { id: 'bg10', category: 'Housing',        amount: 1600, month: '2026-03' },
  { id: 'bg11', category: 'Food & Dining',  amount: 450,  month: '2026-03' },
  { id: 'bg12', category: 'Transportation', amount: 200,  month: '2026-03' },
  { id: 'bg13', category: 'Entertainment',  amount: 100,  month: '2026-03' },
  { id: 'bg14', category: 'Healthcare',     amount: 50,   month: '2026-03' },
  { id: 'bg15', category: 'Shopping',       amount: 200,  month: '2026-03' },
  { id: 'bg16', category: 'Utilities',      amount: 150,  month: '2026-03' },
];

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useFinanceData() {
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem('pft-v2-transactions');
      return saved ? JSON.parse(saved) : SAMPLE_TRANSACTIONS;
    } catch { return SAMPLE_TRANSACTIONS; }
  });

  const [budgets, setBudgets] = useState(() => {
    try {
      const saved = localStorage.getItem('pft-v2-budgets');
      const data = saved ? JSON.parse(saved) : SAMPLE_BUDGETS;
      // migrate old budgets that don't have a type field
      return data.map(b => ({ type: 'expense', ...b }));
    } catch { return SAMPLE_BUDGETS; }
  });

  useEffect(() => {
    localStorage.setItem('pft-v2-transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('pft-v2-budgets', JSON.stringify(budgets));
  }, [budgets]);

  const addTransaction = useCallback((t) => {
    setTransactions(prev => [{ ...t, id: genId() }, ...prev]);
  }, []);

  const deleteTransaction = useCallback((id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const upsertBudget = useCallback((budget) => {
    setBudgets(prev => {
      const existing = prev.find(b =>
        b.category === budget.category &&
        b.month === budget.month &&
        (b.type || 'expense') === (budget.type || 'expense')
      );
      if (existing) {
        return prev.map(b => b.id === existing.id ? { ...b, amount: budget.amount } : b);
      }
      return [...prev, { type: 'expense', ...budget, id: genId() }];
    });
  }, []);

  const deleteBudget = useCallback((id) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  }, []);

  const getSpending = useCallback((month) => {
    const result = {};
    transactions
      .filter(t => t.date.startsWith(month) && t.type === 'expense')
      .forEach(t => { result[t.category] = (result[t.category] || 0) + t.amount; });
    return result;
  }, [transactions]);

  return { transactions, budgets, addTransaction, deleteTransaction, upsertBudget, deleteBudget, getSpending };
}
