import { useState } from 'react';
import { POPULAR_ACCOUNTS, GENERIC_ACCOUNTS } from '../hooks/useFinanceData';
import { ACCOUNT_TYPE_ICONS } from './CategoryIcon';
import { usePreferences, symbolFor } from '../contexts/PreferencesContext';
import CurrencySelect from './CurrencySelect';

export default function OnboardingWizard({ onComplete, onSkip }) {
  const { baseCurrency, updatePrefs } = usePreferences();
  const [step, setStep]       = useState(1); // 1 = pick accounts, 2 = enter balances
  const [selected, setSelected] = useState([]); // array of { name, type, color }
  const [balances, setBalances] = useState({}); // { accountName: { balance, phone, currency } }
  const [showAllBanks, setShowAllBanks] = useState(false);

  // Generic kinds always; named banks only for the chosen currency unless expanded
  const presets = POPULAR_ACCOUNTS.filter(a => showAllBanks || a.currency === baseCurrency);
  const choices = [...GENERIC_ACCOUNTS, ...presets];
  const hiddenBanks = POPULAR_ACCOUNTS.length - presets.length;

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
    selected.forEach(a => { init[a.name] = { balance: '', phone: '', currency: a.currency || baseCurrency }; });
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
      currency: balances[a.name]?.currency || baseCurrency,
    }));
    await onComplete(accounts);
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <img src="/logo-icon.svg" alt="MiAhorro Pocket" className="auth-logo" />
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
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Main currency (totals and budgets are shown in this)</label>
              <CurrencySelect value={baseCurrency} onChange={code => updatePrefs({ currency: code })} />
            </div>
            <div className="onboarding-grid">
              {choices.map(acct => {
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
            {hiddenBanks > 0 && (
              <button type="button" className="auth-switch-link" style={{ alignSelf: 'flex-start', margin: '4px 0 8px' }}
                onClick={() => setShowAllBanks(true)}>
                Show banks from other countries ({hiddenBanks})
              </button>
            )}
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
                        <label>Currency</label>
                        <CurrencySelect
                          value={balances[acct.name]?.currency || baseCurrency}
                          onChange={code => setBalances(p => ({ ...p, [acct.name]: { ...p[acct.name], currency: code } }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Current Balance ({symbolFor(balances[acct.name]?.currency || baseCurrency)})</label>
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
                            placeholder="Phone number"
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
