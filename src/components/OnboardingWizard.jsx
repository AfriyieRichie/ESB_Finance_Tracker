import { useState } from 'react';
import { POPULAR_ACCOUNTS, ACCOUNT_TYPES } from '../hooks/useFinanceData';
import { ACCOUNT_TYPE_ICONS } from './CategoryIcon';
import { useFmt } from '../contexts/PreferencesContext';

export default function OnboardingWizard({ onComplete, onSkip }) {
  const fmt = useFmt();
  const [step, setStep]       = useState(1); // 1 = pick accounts, 2 = enter balances
  const [selected, setSelected] = useState([]); // array of { name, type, color }
  const [balances, setBalances] = useState({}); // { accountName: { balance, phone } }

  const toggle = (acct) => {
    setSelected(prev =>
      prev.find(s => s.name === acct.name)
        ? prev.filter(s => s.name !== acct.name)
        : [...prev, acct]
    );
  };

  const handleNext = () => {
    if (selected.length === 0) return;
    const init = {};
    selected.forEach(a => { init[a.name] = { balance: '', phone: '' }; });
    setBalances(init);
    setStep(2);
  };

  const handleSave = async () => {
    const accounts = selected.map(a => ({
      name:     a.name,
      type:     a.type,
      color:    a.color,
      balance:  parseFloat(balances[a.name]?.balance) || 0,
      phone:    balances[a.name]?.phone || '',
      currency: 'GHS',
    }));
    await onComplete(accounts);
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <img src="/logo-icon.svg" alt="ESB" className="auth-logo" />
          <div>
            <h2 className="onboarding-title">
              {step === 1 ? "Let's set up your accounts" : 'Enter your current balances'}
            </h2>
            <p className="onboarding-sub">
              {step === 1
                ? 'Select all the accounts you use. You can add more later.'
                : 'Enter the balance in each account as of today.'}
            </p>
          </div>
        </div>

        {step === 1 ? (
          <>
            <div className="onboarding-grid">
              {POPULAR_ACCOUNTS.map(acct => {
                const Icon = ACCOUNT_TYPE_ICONS[acct.type];
                const isSelected = selected.find(s => s.name === acct.name);
                return (
                  <button
                    key={acct.name}
                    className={`onboarding-tile ${isSelected ? 'selected' : ''}`}
                    style={{ '--tile-color': acct.color }}
                    onClick={() => toggle(acct)}
                    type="button"
                  >
                    <span className="onboarding-tile-icon">
                      <Icon size={20} strokeWidth={1.5} color="#c8ddd5" />
                    </span>
                    <span className="onboarding-tile-name">{acct.name}</span>
                    {isSelected && <span className="onboarding-tile-check">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="onboarding-actions">
              <button className="btn-ghost" onClick={onSkip} type="button">Skip for now</button>
              <button className="btn-pill" onClick={handleNext} disabled={selected.length === 0} type="button">
                Continue ({selected.length} selected)
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="onboarding-balances">
              {selected.map(acct => {
                const Icon = ACCOUNT_TYPE_ICONS[acct.type];
                return (
                  <div key={acct.name} className="onboarding-balance-row">
                    <div className="ob-account-info">
                      <span className="ob-dot" style={{ background: acct.color }}>
                        <Icon size={14} strokeWidth={1.5} color="#c8ddd5" />
                      </span>
                      <span className="ob-name">{acct.name}</span>
                    </div>
                    <div className="ob-inputs">
                      <div className="form-group">
                        <label>Current Balance (GH₵)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={balances[acct.name]?.balance || ''}
                          onChange={e => setBalances(p => ({ ...p, [acct.name]: { ...p[acct.name], balance: e.target.value } }))}
                        />
                      </div>
                      {acct.type === 'momo' && (
                        <div className="form-group">
                          <label>Phone Number (optional)</label>
                          <input
                            type="tel"
                            placeholder="024 000 0000"
                            value={balances[acct.name]?.phone || ''}
                            onChange={e => setBalances(p => ({ ...p, [acct.name]: { ...p[acct.name], phone: e.target.value } }))}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="onboarding-actions">
              <button className="btn-ghost" onClick={() => setStep(1)} type="button">← Back</button>
              <button className="btn-pill" onClick={handleSave} type="button">Save & Get Started</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
