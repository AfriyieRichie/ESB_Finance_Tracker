import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Budget from './components/Budget';
import Transactions from './components/Transactions';
import Accounts from './components/Accounts';
import OnboardingWizard from './components/OnboardingWizard';
import { useFinanceData } from './hooks/useFinanceData';
import './App.css';

const TABS = [
  { id: 'dashboard',    label: 'Dashboard',   icon: '◉' },
  { id: 'budget',       label: 'Budget',       icon: '◎' },
  { id: 'transactions', label: 'Transactions', icon: '≡' },
  { id: 'accounts',     label: 'Accounts',     icon: '⬡' },
];

const TODAY    = new Date().toISOString().slice(0, 10);
const NUDGE_KEY = `nudge-dismissed-${TODAY}`;
const ONBOARD_SKIP_KEY = 'onboarding-skipped';

function AppContent() {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNudge, setShowNudge] = useState(false);

  const {
    transactions, budgets, accounts, debts, assets, loading,
    addTransaction, deleteTransaction, addTransfer,
    upsertBudget, deleteBudget,
    addAccount, updateAccount, deleteAccount,
    addDebt, updateDebt, deleteDebt,
    addAsset, updateAssetValue, cashOutAsset, deleteAsset,
  } = useFinanceData(currentUser?.uid);

  // Daily nudge
  useEffect(() => {
    if (loading) return;
    if (sessionStorage.getItem(NUDGE_KEY)) return;
    const hasToday = transactions.some(t => t.date === TODAY);
    setShowNudge(!hasToday);
  }, [loading, transactions]);

  const dismissNudge = () => { sessionStorage.setItem(NUDGE_KEY, '1'); setShowNudge(false); };
  const recordNow    = () => { dismissNudge(); setActiveTab('transactions'); };

  // Onboarding
  const showOnboarding = !loading && accounts.length === 0 && !sessionStorage.getItem(ONBOARD_SKIP_KEY);

  const handleOnboardingComplete = async (newAccounts) => {
    for (const acct of newAccounts) await addAccount(acct);
  };
  const handleOnboardingSkip = () => {
    sessionStorage.setItem(ONBOARD_SKIP_KEY, '1');
  };

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
          <button className="logout-btn" onClick={logout} title="Sign out">⏻</button>
        </div>
      </header>

      {showNudge && (
        <div className="nudge-banner">
          <span className="nudge-icon"><Bell size={15} strokeWidth={1.6} color="#f59e0b" /></span>
          <div className="nudge-text">
            <strong>No transactions recorded today.</strong>
            <span> Anything you'd like to add?</span>
          </div>
          <button className="nudge-cta" onClick={recordNow}>Record Now</button>
          <button className="nudge-dismiss" onClick={dismissNudge} title="Dismiss">✕</button>
        </div>
      )}

      <main className="app-main">
        {loading ? (
          <div className="data-loading">
            <div className="data-spinner" />
            <p>Loading your data…</p>
          </div>
        ) : showOnboarding ? (
          <OnboardingWizard
            onComplete={async (accts) => { await handleOnboardingComplete(accts); }}
            onSkip={handleOnboardingSkip}
          />
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
                accounts={accounts}
                debts={debts}
                assets={assets}
                addTransfer={addTransfer}
                budgets={budgets}
              />
            )}
            {activeTab === 'accounts' && (
              <Accounts
                accounts={accounts}
                debts={debts}
                assets={assets}
                addAccount={addAccount}
                updateAccount={updateAccount}
                deleteAccount={deleteAccount}
                addDebt={addDebt}
                updateDebt={updateDebt}
                deleteDebt={deleteDebt}
                addAsset={addAsset}
                updateAssetValue={updateAssetValue}
                cashOutAsset={cashOutAsset}
                deleteAsset={deleteAsset}
                addTransfer={addTransfer}
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
