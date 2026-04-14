import { useState } from 'react';
import Dashboard from './components/Dashboard';
import Budget from './components/Budget';
import Transactions from './components/Transactions';
import { useFinanceData } from './hooks/useFinanceData';
import './App.css';

const TABS = [
  { id: 'dashboard',    label: 'Dashboard',     icon: '◉' },
  { id: 'budget',       label: 'Budget',         icon: '◎' },
  { id: 'transactions', label: 'Transactions',   icon: '≡' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { transactions, budgets, addTransaction, deleteTransaction, upsertBudget, deleteBudget } = useFinanceData();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">💰</span>
          <span className="brand-name">FinanceTracker</span>
        </div>
        <nav className="header-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'dashboard' && (
          <Dashboard transactions={transactions} budgets={budgets} />
        )}
        {activeTab === 'budget' && (
          <Budget
            budgets={budgets}
            transactions={transactions}
            upsertBudget={upsertBudget}
            deleteBudget={deleteBudget}
          />
        )}
        {activeTab === 'transactions' && (
          <Transactions
            transactions={transactions}
            addTransaction={addTransaction}
            deleteTransaction={deleteTransaction}
          />
        )}
      </main>
    </div>
  );
}
