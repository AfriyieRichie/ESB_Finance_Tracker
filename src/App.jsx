import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Budget from './components/Budget';
import Transactions from './components/Transactions';
import { useFinanceData } from './hooks/useFinanceData';
import './App.css';

const TABS = [
  { id: 'dashboard',    label: 'Dashboard',   icon: '◉' },
  { id: 'budget',       label: 'Budget',       icon: '◎' },
  { id: 'transactions', label: 'Transactions', icon: '≡' },
];

function AppContent() {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const { transactions, budgets, loading, addTransaction, deleteTransaction, upsertBudget, deleteBudget } =
    useFinanceData(currentUser?.uid);

  if (!currentUser) return <Auth />;

  const initials = currentUser.displayName
    ? currentUser.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : currentUser.email[0].toUpperCase();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <img src="/logo-icon.svg" alt="ESB Finance Tracker" className="brand-logo" />
          <span className="brand-name">ESB Finance Tracker</span>
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

        <div className="header-user">
          <div className="user-avatar" title={currentUser.displayName || currentUser.email}>
            {initials}
          </div>
          <div className="user-info">
            <span className="user-name">{currentUser.displayName || 'User'}</span>
            <span className="user-email">{currentUser.email}</span>
          </div>
          <button className="logout-btn" onClick={logout} title="Sign out">
            ⏻
          </button>
        </div>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="data-loading">
            <div className="data-spinner" />
            <p>Loading your data…</p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
