// Local-development demo mode: open the dev server with ?demo to see the signed-in app with
// sample data and no Firebase (used for UI reviews and screenshots). `import.meta.env.DEV` is
// false in production builds, so this is compiled out of the live site.
export const DEMO = import.meta.env.DEV &&
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

export const demoUser = {
  uid: 'demo',
  displayName: 'Demo User',
  email: 'demo@example.com',
  metadata: { creationTime: '2026-01-15T10:00:00Z' },
};

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const month = day(0).slice(0, 7);

export function demoData() {
  const accounts = [
    { id: 'a1', name: 'Monzo',          type: 'bank', color: '#ff4f40', currency: 'GBP', balance: 2350.42 },
    { id: 'a2', name: 'Barclays Savings', type: 'bank', color: '#00aeef', currency: 'GBP', balance: 1600 },
    { id: 'a3', name: 'MTN MoMo',       type: 'momo', color: '#eab308', currency: 'GHS', balance: 4310.5, phone: '024 000 0000' },
    { id: 'a4', name: 'Cash',           type: 'cash', color: '#22c55e', currency: 'GHS', balance: 10000 },
  ];
  const tx = (id, offset, description, amount, type, category, accountId, extra = {}) =>
    ({ id, date: day(offset), description, amount, type, category, accountId, ...extra });
  const transactions = [
    tx('t1',  0, 'Groceries at Tesco', 42.1, 'expense', 'Food & Dining', 'a1'),
    tx('t2',  0, 'Monthly salary', 2400, 'income', 'Salary', 'a1'),
    tx('t3',  1, 'Bus pass', 65, 'expense', 'Transportation', 'a1'),
    tx('t4',  1, 'Netflix', 10.99, 'expense', 'Entertainment', 'a1'),
    tx('t5',  2, 'Electricity bill', 88.3, 'expense', 'Utilities', 'a1'),
    tx('t6',  2, 'Pharmacy', 14.5, 'expense', 'Healthcare', 'a1'),
    tx('t7',  3, 'New trainers', 74.99, 'expense', 'Shopping', 'a1'),
    tx('t8',  3, 'Haircut', 18, 'expense', 'Personal Care', 'a1'),
    tx('t9',  4, 'Online course', 29, 'expense', 'Education', 'a1'),
    tx('t10', 4, 'Rent', 650, 'expense', 'Housing', 'a1'),
    tx('t11', 5, 'Market food', 162, 'expense', 'Food & Dining', 'a3'),
    tx('t12', 5, 'Emergency fund top-up', 300, 'savings', 'Emergency Fund', 'a2'),
    tx('t13', 6, 'Freelance design', 450, 'income', 'Freelance', 'a1'),
    { id: 't14', date: day(6), description: 'Send money home', type: 'transfer', amount: 100,
      toAmount: 1552, fromAccountId: 'a1', toAccountId: 'a3', accountId: 'a1', currency: 'GBP', toCurrency: 'GHS' },
    tx('t15', 7, 'Stocks purchase', 150, 'savings', 'Stock Portfolio', 'a1'),
  ];
  const budgets = [
    { id: 'b1', type: 'expense', category: 'Food & Dining',  amount: 300,  month },
    { id: 'b2', type: 'expense', category: 'Housing',        amount: 650,  month },
    { id: 'b3', type: 'expense', category: 'Transportation', amount: 50,   month },
    { id: 'b4', type: 'expense', category: 'Entertainment',  amount: 30,   month },
    { id: 'b5', type: 'income',  category: 'Salary',         amount: 2400, month },
    { id: 'b6', type: 'savings', category: 'Emergency Fund', amount: 400,  month },
  ];
  const debts = [
    { id: 'd1', name: 'Car loan', currency: 'GBP', originalAmount: 6000, currentBalance: 4200, interestRate: 6.9, monthlyPayment: 180 },
  ];
  const assets = [
    { id: 's1', name: 'Treasury bills', assetType: 'tbill', currency: 'GHS', costBasis: 5000, currentValue: 5400, status: 'active', maturityDate: day(-60) },
    { id: 's2', name: 'Index fund', assetType: 'stocks', currency: 'GBP', costBasis: 1200, currentValue: 1310, status: 'active' },
  ];
  return { accounts, transactions, budgets, debts, assets };
}
