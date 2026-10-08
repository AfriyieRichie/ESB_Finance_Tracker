import { useState, useRef, useEffect } from 'react';
import {
  User, Palette, Bell, Shield, Database, LogOut, Trash2,
  Eye, EyeOff, Download, Upload, Lock, Plus, X, Check,
  ChevronRight, ChevronLeft, Sliders, ArrowLeftRight, RefreshCw, Coins,
} from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import { updateProfile, updateEmail, deleteUser } from 'firebase/auth';
import { auth, db, clearLocalData } from '../firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { usePreferences, CURRENCIES } from '../contexts/PreferencesContext';
import { useInstall } from '../pwa';
import { notificationStatus, enableNotifications, notify, pushConfigured } from '../notifications';
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, SAVINGS_CATEGORIES,
  BUSINESS_EXPENSE_CATEGORIES, BUSINESS_INCOME_CATEGORIES,
} from '../hooks/useFinanceData';

// ─── Helpers ───────────────────────────────────────────────────────────────

async function hashPIN(pin) {
  const data = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const COLOR_SWATCHES = ['#e41e20','#b31012','#0072bc','#4f46e5','#0ea5e9','#7c3aed','#eab308','#dc2626','#f97316','#22c55e','#14b8a6','#6b7280','#00e676','#06b6d4','#ec4899','#f59e0b'];

// ─── Shared UI primitives ──────────────────────────────────────────────────

function Section({ icon: Icon, title, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <Icon size={15} strokeWidth={1.6} className="ico" />
        <h3 className="settings-section-title">{title}</h3>
      </div>
      <div className="settings-section-body">{children}</div>
    </div>
  );
}

function SettingsRow({ label, hint, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {hint && <span className="settings-row-hint">{hint}</span>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" className={`s-toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="s-toggle-thumb" />
    </button>
  );
}

function StatusMsg({ msg, error }) {
  if (!msg) return null;
  return <p className={`settings-msg ${error ? 'error' : 'ok'}`}>{msg}</p>;
}

// ─── 1. Profile ────────────────────────────────────────────────────────────

function ProfileSection({ currentUser }) {
  const [name,  setName]  = useState(currentUser.displayName || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState('');

  const initials = (name || currentUser.email)
    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      if (name.trim() !== (currentUser.displayName || ''))
        await updateProfile(auth.currentUser, { displayName: name.trim() });
      if (email.trim() !== currentUser.email)
        await updateEmail(auth.currentUser, email.trim());
      setMsg('Profile updated.');
    } catch (err) {
      setMsg(err.code === 'auth/requires-recent-login'
        ? 'Re-login required to change email. Sign out and back in.'
        : 'Could not update profile. Try again.');
    } finally { setBusy(false); }
  };

  const joined = currentUser.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <Section icon={User} title="Profile">
      <div className="profile-avatar-row">
        <div className="profile-avatar-big">{initials}</div>
        <div>
          <p className="profile-display-name">{currentUser.displayName || 'Your Name'}</p>
          {joined && <p className="profile-joined">Member since {joined}</p>}
        </div>
      </div>
      <form onSubmit={handleSave} className="settings-form">
        <div className="form-group">
          <label>Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
        </div>
        <div className="form-group">
          <label>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <StatusMsg msg={msg} error={msg.includes('Could not') || msg.includes('Re-login')} />
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={busy}>Save Changes</button>
        </div>
      </form>
    </Section>
  );
}

// ─── 2. Preferences ────────────────────────────────────────────────────────

function PreferencesSection() {
  const { prefs, updatePrefs } = usePreferences();

  return (
    <Section icon={Palette} title="Preferences">
      {/* Theme */}
      <SettingsRow label="Theme" hint="Controls the app's colour scheme">
        <div className="seg-control seg-wrap">
          {[['light', '☀ Light'], ['dark', '🌙 Dark'], ['navy', '◆ Navy'], ['sapphire', '💎 Sapphire'], ['system', '⚙ System']].map(([t, label]) => (
            <button key={t} type="button"
              className={`seg-btn ${prefs.theme === t ? 'active' : ''}`}
              onClick={() => updatePrefs({ theme: t })}>
              {label}
            </button>
          ))}
        </div>
      </SettingsRow>

      {/* Number format */}
      <SettingsRow label="Number Format" hint="How amounts are displayed">
        <div className="seg-control">
          <button type="button"
            className={`seg-btn ${prefs.numberFormat === 'comma' ? 'active' : ''}`}
            onClick={() => updatePrefs({ numberFormat: 'comma' })}>
            1,000.00
          </button>
          <button type="button"
            className={`seg-btn ${prefs.numberFormat === 'period' ? 'active' : ''}`}
            onClick={() => updatePrefs({ numberFormat: 'period' })}>
            1.000,00
          </button>
        </div>
      </SettingsRow>

      {/* Budget start day */}
      <SettingsRow label="Budget Period Starts On" hint="Day each month your budget resets (e.g. your pay date)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number" min="1" max="28" step="1"
            className="day-input"
            value={prefs.budgetStartDay}
            onChange={e => {
              const v = Math.min(28, Math.max(1, parseInt(e.target.value) || 1));
              updatePrefs({ budgetStartDay: v });
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>of the month</span>
        </div>
      </SettingsRow>
    </Section>
  );
}

// ─── 2a. Base currency ─────────────────────────────────────────────────────

function BaseCurrencySection() {
  const { prefs, updatePrefs } = usePreferences();
  const [currencySearch, setCurrencySearch] = useState('');

  const filteredCurrencies = CURRENCIES.filter(c =>
    c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currencySearch.toLowerCase())
  );

  return (
    <Section icon={Coins} title="Base Currency">
      <SettingsRow label="Base Currency" hint="Net worth, totals, budgets and charts are converted into this currency">
        <div className="currency-picker">
          <input
            type="text"
            className="currency-search"
            placeholder="Search…"
            value={currencySearch}
            onChange={e => setCurrencySearch(e.target.value)}
          />
          <div className="currency-list">
            {filteredCurrencies.map(c => (
              <button key={c.code} type="button"
                className={`currency-option ${prefs.currency === c.code ? 'active' : ''}`}
                onClick={() => updatePrefs({ currency: c.code })}>
                <span className="currency-symbol">{c.symbol}</span>
                <span className="currency-name">{c.name}</span>
                {prefs.currency === c.code && <Check size={13} strokeWidth={2} />}
              </button>
            ))}
          </div>
        </div>
      </SettingsRow>

    </Section>
  );
}

// ─── 2b. Exchange Rates ────────────────────────────────────────────────────

function ExchangeRateRow({ code }) {
  const { prefs, baseCurrency, liveRates, setFxOverride } = usePreferences();
  const override = prefs.fxOverrides?.[`${baseCurrency}:${code}`];
  const live     = liveRates[code];
  const [value, setValue] = useState(override ? String(override) : '');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const v = parseFloat(value);
    await setFxOverride(code, v > 0 ? v : null);
    if (!(v > 0)) setValue('');
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };
  const clear = async () => { setValue(''); await setFxOverride(code, null); };

  return (
    <SettingsRow
      label={`1 ${baseCurrency} → ${code}`}
      hint={live
        ? `Live rate: ${live.toFixed(4)} ${code}${override ? ' · using your rate' : ''}`
        : 'No live rate available. Enter your own.'}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="number" min="0" step="any" className="fx-rate-input"
          placeholder={live ? live.toFixed(4) : 'Rate'}
          value={value} onChange={e => setValue(e.target.value)} />
        <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={save}>
          {saved ? <Check size={13} strokeWidth={2} /> : 'Save'}
        </button>
        {override && (
          <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={clear} title="Use live rate">
            <X size={13} strokeWidth={1.6} />
          </button>
        )}
      </div>
    </SettingsRow>
  );
}

function ExchangeRatesSection({ accounts, debts, assets }) {
  const { baseCurrency, ratesDate, ratesLoading, ratesError, refreshRates } = usePreferences();
  const inUse = [...new Set([...accounts, ...debts, ...assets].map(x => x.currency))]
    .filter(c => c && c !== baseCurrency)
    .sort();

  return (
    <Section icon={ArrowLeftRight} title="Exchange Rates">
      <SettingsRow
        label="Live rates"
        hint={ratesError || (ratesDate ? `Updated daily · last rates from ${ratesDate}` : 'Not loaded yet')}>
        <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={refreshRates} disabled={ratesLoading}>
          <RefreshCw size={13} strokeWidth={1.6} /> {ratesLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </SettingsRow>
      {inUse.length === 0 ? (
        <p className="settings-row-hint settings-note">
          All your accounts are in {baseCurrency}. Rates appear here once you add an account in another currency.
        </p>
      ) : (
        <>
          <p className="settings-row-hint settings-note">
            Leave blank to use the live rate. Enter your own if the rate you actually get (e.g. via MoMo
            or a remittance app) differs. New transactions save the rate of the day they're recorded.
          </p>
          {inUse.map(code => <ExchangeRateRow key={`${baseCurrency}:${code}`} code={code} />)}
        </>
      )}
    </Section>
  );
}

// ─── 3. Manage Categories ──────────────────────────────────────────────────

// Investment types used by "Add Investment / Asset" (built-ins are fixed; custom ones can be added/removed)
function AssetTypesGroup({ assets = [] }) {
  const { prefs, updatePrefs, assetTypes } = usePreferences();
  const [adding,   setAdding]   = useState(false);
  const [newName,  setNewName]  = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const customs = prefs.customAssetTypes || [];

  const add = () => {
    const label = newName.trim();
    if (!label) return;
    if (assetTypes.some(t => t.label.toLowerCase() === label.toLowerCase())) return;
    const id = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    updatePrefs({ customAssetTypes: [...customs, { id, label, color: newColor }] });
    setNewName(''); setNewColor('#6b7280'); setAdding(false);
  };
  const remove = (id) => updatePrefs({ customAssetTypes: customs.filter(t => t.id !== id) });

  return (
    <div className="cat-manage-group">
      <div className="cat-manage-group-header">
        <span className="cat-manage-type-label">Investment Types</span>
        <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={() => { setAdding(true); setNewName(''); }}>
          <Plus size={12} strokeWidth={2} /> Add
        </button>
      </div>
      <div className="cat-chip-list">
        {assetTypes.map(t => {
          const inUse = assets.filter(a => a.assetType === t.id).length;
          return (
            <div key={t.id} className={`cat-chip ${t.custom ? 'custom-chip' : ''}`}>
              <span className="cat-chip-icon" style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
              <span className="cat-chip-name">{t.label}</span>
              {t.custom && (
                <button type="button" className="cat-chip-toggle danger"
                  disabled={inUse > 0}
                  onClick={() => remove(t.id)}
                  title={inUse > 0 ? `Used by ${inUse} asset${inUse > 1 ? 's' : ''}; remove or change those first` : 'Remove investment type'}>
                  <X size={11} strokeWidth={1.8} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {adding && (
        <div className="cat-add-form">
          <input type="text" placeholder="e.g. ISA, Premium Bonds, Pension" value={newName}
            onChange={e => setNewName(e.target.value)} autoFocus />
          <div className="cat-color-picker">
            {COLOR_SWATCHES.map(col => (
              <button key={col} type="button"
                className={`color-swatch ${newColor === col ? 'selected' : ''}`}
                style={{ background: col }} onClick={() => setNewColor(col)} />
            ))}
          </div>
          <div className="cat-add-actions">
            <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={add} disabled={!newName.trim()}>Add Type</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageCategoriesSection({ assets }) {
  const { prefs, updatePrefs } = usePreferences();
  const [addingFor, setAddingFor] = useState(null); // 'expense' | 'income' | 'savings'
  const [newName,   setNewName]   = useState('');
  const [newColor,  setNewColor]  = useState('#6b7280');

  const hidden  = new Set(prefs.hiddenCategories || []);
  const customs = prefs.customCategories || [];

  const toggleHide = (key) => {
    const next = hidden.has(key)
      ? (prefs.hiddenCategories || []).filter(k => k !== key)
      : [...(prefs.hiddenCategories || []), key];
    updatePrefs({ hiddenCategories: next });
  };

  const addCustom = () => {
    if (!newName.trim()) return;
    const cat = { type: addingFor, name: newName.trim(), color: newColor };
    updatePrefs({ customCategories: [...customs, cat] });
    setNewName(''); setNewColor('#6b7280'); setAddingFor(null);
  };

  const removeCustom = (name, type) => {
    updatePrefs({ customCategories: customs.filter(c => !(c.name === name && c.type === type)) });
  };

  const renderGroup = (label, cats, type) => {
    const customOfType = customs.filter(c => c.type === type);
    return (
      <div className="cat-manage-group">
        <div className="cat-manage-group-header">
          <span className="cat-manage-type-label">{label}</span>
          <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => { setAddingFor(type); setNewName(''); }}>
            <Plus size={12} strokeWidth={2} /> Add
          </button>
        </div>
        <div className="cat-chip-list">
          {cats.map(c => {
            const key = `${type}:${c.name}`;
            const isHidden = hidden.has(key);
            return (
              <div key={c.name} className={`cat-chip ${isHidden ? 'hidden-chip' : ''}`}>
                <span className="cat-chip-icon"><CategoryIcon name={c.name} size={13} /></span>
                <span className="cat-chip-name">{c.name}</span>
                <button type="button" className="cat-chip-toggle" onClick={() => toggleHide(key)}
                  title={isHidden ? 'Show' : 'Hide'}>
                  {isHidden ? <Eye size={11} strokeWidth={1.8} /> : <EyeOff size={11} strokeWidth={1.8} />}
                </button>
              </div>
            );
          })}
          {customOfType.map(c => (
            <div key={c.name} className="cat-chip custom-chip">
              <span className="cat-chip-icon"><CategoryIcon name={c.name} size={13} /></span>
              <span className="cat-chip-name">{c.name}</span>
              <button type="button" className="cat-chip-toggle danger"
                onClick={() => removeCustom(c.name, type)} title="Remove custom category">
                <X size={11} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>

        {addingFor === type && (
          <div className="cat-add-form">
            <input type="text" placeholder="Category name" value={newName}
              onChange={e => setNewName(e.target.value)} autoFocus />
            <div className="cat-color-picker">
              {COLOR_SWATCHES.map(col => (
                <button key={col} type="button"
                  className={`color-swatch ${newColor === col ? 'selected' : ''}`}
                  style={{ background: col }} onClick={() => setNewColor(col)} />
              ))}
            </div>
            <div className="cat-add-actions">
              <button type="button" className="btn-secondary" onClick={() => setAddingFor(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={addCustom} disabled={!newName.trim()}>Add Category</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Section icon={Sliders} title="Manage Categories">
      <p className="settings-row-hint settings-note">
        Hide built-in categories you don't use. Hidden categories won't appear in dropdowns
        but historical transactions still reference them correctly.
      </p>
      {renderGroup('Expense', EXPENSE_CATEGORIES, 'expense')}
      {renderGroup('Income',  INCOME_CATEGORIES,  'income')}
      {renderGroup('Savings', SAVINGS_CATEGORIES, 'savings')}
      {renderGroup('Business costs (projects)',  BUSINESS_EXPENSE_CATEGORIES, 'business-expense')}
      {renderGroup('Business income (projects)', BUSINESS_INCOME_CATEGORIES,  'business-income')}
      <AssetTypesGroup assets={assets} />
    </Section>
  );
}

// ─── 4. Notifications ─────────────────────────────────────────────────────

function InstallRow() {
  const { installed, canPrompt, iosManual, promptInstall } = useInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (installed) {
    return (
      <SettingsRow label="Install app" hint="You're using the installed app">
        <span className="settings-ok"><Check size={13} strokeWidth={2} /> Installed</span>
      </SettingsRow>
    );
  }
  return (
    <>
      <SettingsRow label="Install app" hint="Add MiAhorro to your home screen. Opens full-screen and works offline">
        {canPrompt ? (
          <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={promptInstall}>
            <Download size={13} strokeWidth={1.6} /> Install
          </button>
        ) : iosManual ? (
          <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setShowIosHelp(v => !v)}>
            How to install
          </button>
        ) : (
          <span className="settings-row-hint">Use your browser menu → "Install app" / "Add to Home screen"</span>
        )}
      </SettingsRow>
      {showIosHelp && (
        <ol className="install-steps">
          <li>Open this site in <strong>Safari</strong>.</li>
          <li>Tap the <strong>Share</strong> button (square with an arrow).</li>
          <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
          <li>Open MiAhorro from your home screen to turn on notifications.</li>
        </ol>
      )}
    </>
  );
}

function PushRow() {
  const [status, setStatus] = useState(notificationStatus);
  const [busy,   setBusy]   = useState(false);
  const [msg,    setMsg]    = useState('');

  const enable = async () => {
    setBusy(true); setMsg('');
    const { permission, push } = await enableNotifications(auth.currentUser?.uid);
    setStatus(permission);
    if (permission === 'granted') {
      setMsg(push || !pushConfigured()
        ? 'Notifications are on for this device.'
        : 'Notifications are on, but this device could not be registered for reminders. Try again later.');
    }
    setBusy(false);
  };

  const hint = {
    granted:         'On for this device',
    denied:          'Blocked. Allow notifications for this site in your browser or phone settings',
    default:         'Get alerts on this device',
    'needs-install': 'On iPhone, install the app to your home screen first',
    unsupported:     'Not supported in this browser',
  }[status];

  return (
    <>
      <SettingsRow label="Push notifications" hint={hint}>
        {status === 'default' && (
          <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={enable} disabled={busy}>
            <Bell size={13} strokeWidth={1.6} /> {busy ? 'Enabling…' : 'Enable'}
          </button>
        )}
        {status === 'granted' && (
          <button type="button" className="btn-ghost" style={{ fontSize: 13 }} disabled={busy}
            onClick={async () => {
              setBusy(true); setMsg('');
              const res = await notify('Notifications are working', 'You\'ll get your MiAhorro alerts here.', 'test');
              setMsg(res.ok
                ? 'Test sent. Check your notification bar. If nothing appears, turn on notifications for this app in your phone settings.'
                : `Could not send the test: ${res.reason}`);
              setBusy(false);
            }}>
            {busy ? 'Sending…' : 'Send test'}
          </button>
        )}
      </SettingsRow>
      <StatusMsg msg={msg} error={/could not/i.test(msg)} />
    </>
  );
}

function NotificationsSection() {
  const { prefs, updateNotifications, currencySymbol } = usePreferences();
  const n = prefs.notifications;

  return (
    <Section icon={Bell} title="Notifications">
      <InstallRow />
      <PushRow />
      <p className="settings-row-hint settings-note">
        Budget and large-transaction alerts notify you as you record transactions. The daily reminder
        (8pm, only if nothing was recorded) and weekly digest (Sundays, 6pm) arrive even when the app is closed.
      </p>
      <SettingsRow label="Budget alerts" hint="Warn when a category hits 80% of its budget">
        <Toggle checked={n.budgetAlert} onChange={v => updateNotifications({ budgetAlert: v })} />
      </SettingsRow>
      <SettingsRow label="Daily transaction reminder" hint="8pm push, plus an in-app banner, if nothing was recorded today">
        <Toggle checked={n.billReminders} onChange={v => updateNotifications({ billReminders: v })} />
      </SettingsRow>
      <SettingsRow label="Weekly digest" hint="Sunday 6pm: spent, income, saved and top category">
        <Toggle checked={n.weeklyDigest} onChange={v => updateNotifications({ weeklyDigest: v })} />
      </SettingsRow>
      <SettingsRow label="Goal milestones" hint="Celebrate when a savings goal is reached">
        <Toggle checked={n.goalMilestone} onChange={v => updateNotifications({ goalMilestone: v })} />
      </SettingsRow>
      <SettingsRow label="Large transaction alert" hint={`Alert when a single transaction exceeds the threshold`}>
        <Toggle checked={n.largeTransaction} onChange={v => updateNotifications({ largeTransaction: v })} />
      </SettingsRow>
      {n.largeTransaction && (
        <SettingsRow label={`Large transaction threshold (${currencySymbol})`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min="1" step="1"
              className="day-input" style={{ width: 90 }}
              value={n.largeTransactionThreshold}
              onChange={e => updateNotifications({ largeTransactionThreshold: parseInt(e.target.value) || 500 })}
            />
          </div>
        </SettingsRow>
      )}
    </Section>
  );
}

// ─── 5. Security ──────────────────────────────────────────────────────────

function SecuritySection() {
  const { prefs, updatePrefs, setLocked } = usePreferences();
  const [pinStep,  setPinStep]  = useState(null); // null | 'enter' | 'confirm'
  const [pin1,     setPin1]     = useState('');
  const [pin2,     setPin2]     = useState('');
  const [pinErr,   setPinErr]   = useState('');
  const [pinBusy,  setPinBusy]  = useState(false);

  const startSetPin  = () => { setPinStep('enter'); setPin1(''); setPin2(''); setPinErr(''); };
  const cancelPin    = () => { setPinStep(null); setPin1(''); setPin2(''); setPinErr(''); };

  const handlePinNext = async () => {
    if (pin1.length !== 4) { setPinErr('PIN must be exactly 4 digits.'); return; }
    if (pinStep === 'enter') { setPinStep('confirm'); setPin2(''); setPinErr(''); return; }
    if (pin2 !== pin1) { setPinErr('PINs do not match. Try again.'); setPin2(''); return; }
    setPinBusy(true);
    const hash = await hashPIN(pin1);
    await updatePrefs({ pinHash: hash });
    setPinStep(null); setPin1(''); setPin2('');
    setPinBusy(false);
  };

  const removePin = async () => {
    if (!window.confirm('Remove PIN lock? The app will no longer require a PIN on load.')) return;
    await updatePrefs({ pinHash: null });
    setLocked(false);
  };

  const LOCK_OPTIONS = [
    { value: -1, label: 'Immediately (on tab switch)' },
    { value: 1,  label: '1 minute' },
    { value: 5,  label: '5 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 0,  label: 'Never' },
  ];

  return (
    <Section icon={Shield} title="Security">
      <SettingsRow label="Hide balances" hint="Replace all amounts with •••••• on the dashboard">
        <Toggle checked={prefs.hideBalances} onChange={v => updatePrefs({ hideBalances: v })} />
      </SettingsRow>

      <SettingsRow
        label="PIN lock"
        hint={prefs.pinHash ? 'PIN is set — app locks on load' : 'Protect the app with a 4-digit PIN'}>
        <div style={{ display: 'flex', gap: 8 }}>
          {prefs.pinHash ? (
            <>
              <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={startSetPin}>Change PIN</button>
              <button type="button" className="btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={removePin}>Remove</button>
            </>
          ) : (
            <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={startSetPin}>Set PIN</button>
          )}
        </div>
      </SettingsRow>

      {pinStep && (
        <div className="pin-setup-panel">
          <p className="pin-setup-label">
            {pinStep === 'enter' ? 'Enter a 4-digit PIN' : 'Confirm your PIN'}
          </p>
          <input
            type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
            className="pin-input"
            value={pinStep === 'enter' ? pin1 : pin2}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              pinStep === 'enter' ? setPin1(v) : setPin2(v);
              setPinErr('');
            }}
            autoFocus
            placeholder="••••"
          />
          {pinErr && <p className="pin-error">{pinErr}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={cancelPin}>Cancel</button>
            <button type="button" className="btn-primary" disabled={pinBusy} onClick={handlePinNext}>
              {pinStep === 'enter' ? 'Next' : 'Save PIN'}
            </button>
          </div>
        </div>
      )}

      {prefs.pinHash && (
        <SettingsRow label="Auto-lock timeout" hint="Lock the app after this much idle time">
          <select
            value={prefs.autoLockTimeout}
            onChange={e => updatePrefs({ autoLockTimeout: parseInt(e.target.value) })}>
            {LOCK_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </SettingsRow>
      )}
    </Section>
  );
}

// ─── 6. Data ───────────────────────────────────────────────────────────────

function DataSection({ transactions, accounts }) {
  const [importing, setImporting]   = useState(false);
  const [preview,   setPreview]     = useState(null); // { valid, invalid }
  const [importBusy, setImportBusy] = useState(false);
  const fileRef = useRef(null);

  const acctMap = Object.fromEntries(accounts.map(a => [a.name.toLowerCase(), a.id]));

  // ── Export CSV ─────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = 'date,description,amount,currency,type,category,account';
    const rows = transactions.map(t => {
      const acct = accounts.find(a => a.id === (t.accountId || t.fromAccountId));
      return [
        t.date,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount,
        t.currency || acct?.currency || '',
        t.type,
        t.category || '',
        acct?.name || '',
      ].join(',');
    });
    downloadFile([header, ...rows].join('\n'), 'transactions.csv', 'text/csv');
  };

  // ── Download CSV template ──────────────────────────────────────────────
  const downloadTemplate = () => {
    const header  = 'date,description,amount,type,category,account';
    const example = '2026-01-15,Grocery Shopping,120.50,expense,Food & Dining,MTN MoMo';
    downloadFile([header, example].join('\n'), 'import_template.csv', 'text/csv');
  };

  // ── Export PDF (print) ─────────────────────────────────────────────────
  const exportPDF = () => {
    const now = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const rows = transactions.slice(0, 500).map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${t.description}</td>
        <td>${t.category || t.type}</td>
        <td>${t.type}</td>
        <td style="text-align:right">${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)} ${t.currency || ''}</td>
      </tr>`).join('');
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Finance Report – ${now}</title>
      <style>
        body { font-family: sans-serif; font-size: 12px; color: #111; }
        h1   { font-size: 18px; margin-bottom: 4px; }
        p    { color: #555; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: 600; }
      </style></head>
      <body>
        <h1>Transaction Report</h1>
        <p>Generated ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload = () => { window.print(); }<\/script>
      </body></html>`);
    win.document.close();
  };

  // ── Parse uploaded CSV ─────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines  = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean);
      const [header, ...dataRows] = lines;
      const cols = header.split(',');
      const valid = [], invalid = [];

      dataRows.forEach((row, i) => {
        const vals = row.match(/(".*?"|[^,]+)/g) || [];
        const get  = (col) => (vals[cols.indexOf(col)] || '').replace(/^"|"$/g, '').trim();

        const date   = get('date');
        const desc   = get('description');
        const amt    = parseFloat(get('amount'));
        const type   = get('type');
        const cat    = get('category');
        const acctName = get('account');

        const errors = [];
        if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) errors.push('invalid date');
        if (!desc) errors.push('missing description');
        if (isNaN(amt) || amt <= 0) errors.push('invalid amount');
        if (!['income','expense','savings'].includes(type)) errors.push('invalid type');
        const accountId = acctMap[acctName.toLowerCase()];
        if (!accountId) errors.push(`account "${acctName}" not found`);

        if (errors.length) {
          invalid.push({ row: i + 2, raw: row, errors });
        } else {
          valid.push({ date, description: desc, amount: amt, type, category: cat, accountId });
        }
      });
      setPreview({ valid, invalid });
      setImporting(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = async (addTransaction) => {
    if (!preview?.valid?.length) return;
    setImportBusy(true);
    for (const tx of preview.valid) {
      await addTransaction(tx);
    }
    setImportBusy(false);
    setImporting(false);
    setPreview(null);
  };

  return (
    <Section icon={Database} title="Data">
      <SettingsRow label="Export CSV" hint="Download all transactions as a spreadsheet">
        <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={exportCSV}>
          <Download size={13} strokeWidth={1.6} /> Export
        </button>
      </SettingsRow>

      <SettingsRow label="Export PDF" hint="Opens a print-ready report in a new tab">
        <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={exportPDF}>
          <Download size={13} strokeWidth={1.6} /> Export
        </button>
      </SettingsRow>

      <SettingsRow label="Import CSV" hint="Bulk-add past transactions from a spreadsheet">
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={downloadTemplate}>
            Template
          </button>
          <button type="button" className="btn-ghost" style={{ fontSize: 13 }}
            onClick={() => fileRef.current?.click()}>
            <Upload size={13} strokeWidth={1.6} /> Upload
          </button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      </SettingsRow>

      {/* Import preview modal */}
      {importing && preview && (
        <div className="modal-overlay" onClick={() => setImporting(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Preview</h3>
              <button className="modal-close" onClick={() => setImporting(false)}>✕</button>
            </div>
            <div style={{ padding: '0 4px', maxHeight: 320, overflowY: 'auto' }}>
              {preview.valid.length > 0 && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--success)', marginBottom: 8 }}>
                    {preview.valid.length} row{preview.valid.length !== 1 ? 's' : ''} ready to import
                  </p>
                  <div className="import-preview-list">
                    {preview.valid.slice(0, 10).map((t, i) => (
                      <div key={i} className="import-row">
                        <span className="import-row-date">{t.date}</span>
                        <span className="import-row-desc">{t.description}</span>
                        <span className="import-row-amt">{t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    {preview.valid.length > 10 && (
                      <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '6px 0' }}>
                        …and {preview.valid.length - 10} more
                      </p>
                    )}
                  </div>
                </>
              )}
              {preview.invalid.length > 0 && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--danger)', margin: '12px 0 8px' }}>
                    {preview.invalid.length} row{preview.invalid.length !== 1 ? 's' : ''} will be skipped
                  </p>
                  {preview.invalid.map((r, i) => (
                    <div key={i} className="import-row error">
                      <span className="import-row-date">Row {r.row}</span>
                      <span className="import-row-desc">{r.errors.join(', ')}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setImporting(false)}>Cancel</button>
              <button type="button" className="btn-primary"
                disabled={!preview.valid.length || importBusy}
                onClick={() => confirmImport(window.__addTransaction)}>
                {importBusy ? 'Importing…' : `Import ${preview.valid.length} Transactions`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── 7. Account actions ────────────────────────────────────────────────────

const USER_COLLECTIONS = ['transactions','budgets','accounts','debts','assets','projects','preferences','pushTokens','meta'];

// Deletes every document in the user's subcollections, in batches of ≤500 (Firestore limit)
async function wipeUserData(uid) {
  for (const col of USER_COLLECTIONS) {
    const snap = await getDocs(collection(db, 'users', uid, col));
    for (let i = 0; i < snap.docs.length; i += 500) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
}

function AccountSection({ logout }) {
  const [showReset,  setShowReset]  = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [resetBusy,  setResetBusy]  = useState(false);
  const [resetErr,   setResetErr]   = useState('');

  const [showDelete,  setShowDelete]  = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteBusy,  setDeleteBusy]  = useState(false);
  const [deleteErr,   setDeleteErr]   = useState('');

  const handleDelete = async () => {
    if (deleteInput !== 'DELETE') {
      setDeleteErr('Type DELETE (all caps) to confirm.'); return;
    }
    setDeleteBusy(true);
    try {
      await wipeUserData(auth.currentUser.uid);
      await deleteUser(auth.currentUser);
      await clearLocalData();
    } catch (err) {
      setDeleteErr(err.code === 'auth/requires-recent-login'
        ? 'Re-login required before deleting your account.'
        : 'Failed to delete account. Please try again.');
      setDeleteBusy(false);
    }
  };

  const closeReset = () => { setShowReset(false); setResetInput(''); setResetErr(''); };

  const handleReset = async () => {
    if (resetInput !== 'RESET') {
      setResetErr('Type RESET (all caps) to confirm.'); return;
    }
    setResetBusy(true);
    try {
      await wipeUserData(auth.currentUser.uid);
      sessionStorage.removeItem('onboarding-skipped');
      closeReset();
    } catch {
      setResetErr('Failed to reset data. Please try again.');
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <Section icon={LogOut} title="Account">
      <SettingsRow label="Sign out" hint="End your session and return to the login screen">
        <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={logout}>
          <LogOut size={13} strokeWidth={1.6} /> Sign Out
        </button>
      </SettingsRow>

      <SettingsRow label="Reset all data" hint="Erase all transactions, accounts, budgets, debts, assets and preferences but keep your login">
        <button type="button" className="btn-ghost"
          style={{ fontSize: 13, color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={() => setShowReset(true)}>
          <Trash2 size={13} strokeWidth={1.6} /> Reset
        </button>
      </SettingsRow>

      <SettingsRow label="Delete account" hint="Permanently delete all your data — this cannot be undone">
        <button type="button" className="btn-ghost"
          style={{ fontSize: 13, color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={() => setShowDelete(true)}>
          <Trash2 size={13} strokeWidth={1.6} /> Delete
        </button>
      </SettingsRow>

      {showReset && (
        <div className="modal-overlay" onClick={closeReset}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger)' }}>Reset All Data</h3>
              <button className="modal-close" onClick={closeReset}>✕</button>
            </div>
            <div className="modal-form">
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
                This will permanently erase <strong>all your transactions, budgets, accounts,
                debts, assets and preferences</strong>. Your login stays, and you'll start
                again from the setup wizard. This cannot be undone. You may want to export
                your data first.
              </p>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Type <strong>RESET</strong> to confirm</label>
                <input type="text" value={resetInput}
                  onChange={e => { setResetInput(e.target.value); setResetErr(''); }}
                  placeholder="RESET" autoFocus />
              </div>
              {resetErr && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{resetErr}</p>}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeReset}>Cancel</button>
                <button type="button" className="btn-primary"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                  disabled={resetBusy || resetInput !== 'RESET'}
                  onClick={handleReset}>
                  {resetBusy ? 'Resetting…' : 'Reset Everything'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--danger)' }}>Delete Account</h3>
              <button className="modal-close" onClick={() => setShowDelete(false)}>✕</button>
            </div>
            <div className="modal-form">
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
                This will permanently delete <strong>all your transactions, budgets, accounts,
                debts, and assets</strong>. This action is irreversible and cannot be undone.
              </p>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Type <strong>DELETE</strong> to confirm</label>
                <input type="text" value={deleteInput}
                  onChange={e => { setDeleteInput(e.target.value); setDeleteErr(''); }}
                  placeholder="DELETE" autoFocus />
              </div>
              {deleteErr && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{deleteErr}</p>}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
                <button type="button" className="btn-primary"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                  disabled={deleteBusy || deleteInput !== 'DELETE'}
                  onClick={handleDelete}>
                  {deleteBusy ? 'Deleting…' : 'Delete Everything'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────

// Settings groups: each opens its own page from the Settings menu
const SETTINGS_PAGES = [
  { id: 'general',       title: 'General',            icon: Palette,        desc: 'Theme, number format and budget start day' },
  { id: 'currency',      title: 'Currency & Rates',   icon: Coins,          desc: 'Base currency and exchange rates' },
  { id: 'categories',    title: 'Categories',         icon: Sliders,        desc: 'Hide or add categories and investment types' },
  { id: 'notifications', title: 'Notifications',      icon: Bell,           desc: 'Install the app, push notifications and alerts' },
  { id: 'security',      title: 'Security & Privacy', icon: Shield,         desc: 'Hide balances, PIN lock and auto-lock' },
  { id: 'data',          title: 'Data',               icon: Database,       desc: 'Export and import your transactions' },
  { id: 'account',       title: 'Account',            icon: User,           desc: 'Profile, sign out, reset or delete' },
];

export default function Settings({ currentUser, logout, transactions, accounts, debts, assets, addTransaction }) {
  // Expose addTransaction for the import confirm callback
  window.__addTransaction = addTransaction;

  // Which group page is open (null = the menu). Each page is a browser history entry, so the
  // phone's back gesture returns to the menu instead of leaving the app.
  const [pageId, setPageId] = useState(null);
  useEffect(() => {
    const onPop = (e) => setPageId(e.state?.settingsPage || null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openPage = (id) => {
    window.history.pushState({ settingsPage: id }, '');
    setPageId(id);
    window.scrollTo(0, 0);
  };
  const backToMenu = () => {
    if (window.history.state?.settingsPage) window.history.back();
    else setPageId(null);
    window.scrollTo(0, 0);
  };

  const page = SETTINGS_PAGES.find(p => p.id === pageId);

  if (page) {
    return (
      <div className="settings-page">
        <nav className="settings-crumb" aria-label="Breadcrumb">
          <button type="button" onClick={backToMenu}>
            <ChevronLeft size={15} strokeWidth={2} /> Settings
          </button>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{page.title}</span>
        </nav>
        <div className="page-header"><h2>{page.title}</h2></div>
        <div className="settings-layout settings-subpage">
          {page.id === 'general'       && <PreferencesSection />}
          {page.id === 'currency'      && (<>
            <BaseCurrencySection />
            <ExchangeRatesSection accounts={accounts} debts={debts} assets={assets} />
          </>)}
          {page.id === 'categories'    && <ManageCategoriesSection assets={assets} />}
          {page.id === 'notifications' && <NotificationsSection />}
          {page.id === 'security'      && <SecuritySection />}
          {page.id === 'data'          && <DataSection transactions={transactions} accounts={accounts} />}
          {page.id === 'account'       && (<>
            <ProfileSection currentUser={currentUser} />
            <AccountSection logout={logout} />
          </>)}
        </div>
      </div>
    );
  }

  const initials = (currentUser.displayName || currentUser.email || '?')
    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      {/* Who's signed in; opens the Account page */}
      <button type="button" className="settings-profile-card" onClick={() => openPage('account')}>
        <span className="profile-avatar-big">{initials}</span>
        <span className="settings-profile-text">
          <span className="settings-profile-name">{currentUser.displayName || 'Your account'}</span>
          <span className="settings-profile-email">{currentUser.email}</span>
        </span>
        <ChevronRight size={18} strokeWidth={1.8} className="settings-menu-chevron" />
      </button>

      <div className="settings-menu">
        {SETTINGS_PAGES.map(p => {
          const Icon = p.icon;
          return (
            <button key={p.id} type="button" className="settings-menu-item" onClick={() => openPage(p.id)}>
              <span className="settings-menu-icon"><Icon size={17} strokeWidth={1.7} /></span>
              <span className="settings-menu-text">
                <span className="settings-menu-title">{p.title}</span>
                <span className="settings-menu-desc">{p.desc}</span>
              </span>
              <ChevronRight size={18} strokeWidth={1.8} className="settings-menu-chevron" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
