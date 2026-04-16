import { useState, useEffect } from 'react';
import { Bell, Settings as SettingsIcon, Lock } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PreferencesProvider, usePreferences } from './contexts/PreferencesContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Budget from './components/Budget';
import Transactions from './components/Transactions';
import Accounts from './components/Accounts';
import Settings from './components/Settings';
import OnboardingWizard from './components/OnboardingWizard';
import { useFinanceData } from './hooks/useFinanceData';
import './App.css';

const TABS = [
  { id: 'dashboard',    label: 'Dashboard',   icon: '◉' },
  { id: 'budget',       label: 'Budget',       icon: '◎' },
  { id: 'transactions', label: 'Transactions', icon: '≡' },
  { id: 'accounts',     label: 'Accounts',     icon: '⬡' },
];

const TODAY          = new Date().toISOString().slice(0, 10);
const NUDGE_KEY      = `nudge-dismissed-${TODAY}`;
const ONBOARD_SKIP_KEY = 'onboarding-skipped';

// ─── PIN Lock Screen ───────────────────────────────────────────────────────

function PinLock({ pinHash, onUnlock }) {
  const [pin,   setPin]   = useState('');
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) return;
    setBusy(true);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''));
    if (hash === pinHash) {
      onUnlock();
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
    }
    setBusy(false);
  };

  return (
    <div className="pin-lock-overlay">
      <div className="pin-lock-card">
        <div className="pin-lock-icon"><Lock size={32} strokeWidth={1.4} color="#00e676" /></div>
        <h2 className="pin-lock-title">App Locked</h2>
        <p className="pin-lock-sub">Enter your PIN to continue</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
            className="pin-lock-input"
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g,'').slice(0,4)); setError(''); }}
            placeholder="••••"
            autoFocus
          />
          {error && <p className="pin-lock-error">{error}</p>}
          <button type="submit" className="btn-pill" style={{ width: '100%', marginTop: 16 }} disabled={pin.length !== 4 || busy}>
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main App Content ──────────────────────────────────────────────────────

function AppContent() {
  const { currentUser, logout } = useAuth();
  const { prefs, locked, setLocked } = usePreferences();
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

  // ── Daily nudge ────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (sessionStorage.getItem(NUDGE_KEY)) return;
    if (!prefs.notifications?.billReminders) return;
    setShowNudge(!transactions.some(t => t.date === TODAY));
  }, [loading, transactions, prefs.notifications?.billReminders]);

  const dismissNudge = () => { sessionStorage.setItem(NUDGE_KEY, '1'); setShowNudge(false); };
  const recordNow    = () => { dismissNudge(); setActiveTab('transactions'); };

  // ── Auto-lock idle timer ───────────────────────────────────────────────
  useEffect(() => {
    if (!prefs.pinHash || prefs.autoLockTimeout === 0) return;

    if (prefs.autoLockTimeout === -1) {
      // Lock immediately when tab loses focus
      const handler = () => { if (document.hidden) setLocked(true); };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    }

    // Lock after idle timeout
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setLocked(true), prefs.autoLockTimeout * 60 * 1000);
    };
    const events = ['mousemove','keydown','click','touchstart','scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [prefs.pinHash, prefs.autoLockTimeout, setLocked]);

  // ── Onboarding ─────────────────────────────────────────────────────────
  const showOnboarding = !loading && accounts.length === 0 && !sessionStorage.getItem(ONBOARD_SKIP_KEY);
  const handleOnboardingComplete = async (newAccounts) => {
    for (const acct of newAccounts) await addAccount(acct);
  };
  const handleOnboardingSkip = () => sessionStorage.setItem(ONBOARD_SKIP_KEY, '1');

  if (!currentUser) return <Auth />;

  // Show PIN lock if locked
  if (locked && prefs.pinHash) {
    return <PinLock pinHash={prefs.pinHash} onUnlock={() => setLocked(false)} />;
  }

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
            <button key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="header-user">
          <div className="user-avatar" title={currentUser.displayName || currentUser.email}
            onClick={() => setActiveTab('settings')} style={{ cursor: 'pointer' }}>
            {initials}
          </div>
          <div className="user-info">
            <span className="user-name">{currentUser.displayName || 'User'}</span>
            <span className="user-email">{currentUser.email}</span>
          </div>
          <button className="nav-tab icon-only-tab"
            title="Settings"
            onClick={() => setActiveTab('settings')}
            style={{ color: activeTab === 'settings' ? 'var(--indigo)' : undefined }}>
            <SettingsIcon size={16} strokeWidth={1.6} color={activeTab === 'settings' ? '#00e676' : '#c8ddd5'} />
          </button>
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
              <Dashboard transactions={transactions} budgets={budgets}
                accounts={accounts} debts={debts} assets={assets} />
            )}
            {activeTab === 'budget' && (
              <Budget budgets={budgets} transactions={transactions}
                upsertBudget={upsertBudget} deleteBudget={deleteBudget} />
            )}
            {activeTab === 'transactions' && (
              <Transactions
                transactions={transactions} addTransaction={addTransaction}
                deleteTransaction={deleteTransaction} accounts={accounts}
                debts={debts} assets={assets} addTransfer={addTransfer} budgets={budgets}
              />
            )}
            {activeTab === 'accounts' && (
              <Accounts
                accounts={accounts} debts={debts} assets={assets}
                addAccount={addAccount} updateAccount={updateAccount} deleteAccount={deleteAccount}
                addDebt={addDebt} updateDebt={updateDebt} deleteDebt={deleteDebt}
                addAsset={addAsset} updateAssetValue={updateAssetValue}
                cashOutAsset={cashOutAsset} deleteAsset={deleteAsset} addTransfer={addTransfer}
              />
            )}
            {activeTab === 'settings' && (
              <Settings
                currentUser={currentUser} logout={logout}
                transactions={transactions} accounts={accounts}
                addTransaction={addTransaction}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────

function AuthedApp() {
  const { currentUser } = useAuth();
  return (
    <PreferencesProvider userId={currentUser?.uid}>
      <AppContent />
    </PreferencesProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  );
}
