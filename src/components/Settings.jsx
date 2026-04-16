import { useState, useRef, useCallback } from 'react';
import {
  User, Palette, Bell, Shield, Database, LogOut, Trash2,
  Eye, EyeOff, Download, Upload, Lock, Plus, X, Check,
  ChevronRight, Sliders,
} from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import { updateProfile, updateEmail, deleteUser } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { usePreferences, CURRENCIES } from '../contexts/PreferencesContext';
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, SAVINGS_CATEGORIES,
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
        <Icon size={15} strokeWidth={1.6} color="#c8ddd5" />
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
  const [currencySearch, setCurrencySearch] = useState('');

  const filteredCurrencies = CURRENCIES.filter(c =>
    c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currencySearch.toLowerCase())
  );

  return (
    <Section icon={Palette} title="Preferences">
      {/* Theme */}
      <SettingsRow label="Theme" hint="Controls the app's colour scheme">
        <div className="seg-control">
          {['light','dark','system'].map(t => (
            <button key={t} type="button"
              className={`seg-btn ${prefs.theme === t ? 'active' : ''}`}
              onClick={() => updatePrefs({ theme: t })}>
              {t === 'light' ? '☀ Light' : t === 'dark' ? '🌙 Dark' : '⚙ System'}
            </button>
          ))}
        </div>
      </SettingsRow>

      {/* Currency */}
      <SettingsRow label="Currency" hint="Symbol shown on all amounts (no conversion)">
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

// ─── 3. Manage Categories ──────────────────────────────────────────────────

function ManageCategoriesSection() {
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
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.6 }}>
        Hide built-in categories you don't use. Hidden categories won't appear in dropdowns
        but historical transactions still reference them correctly.
      </p>
      {renderGroup('Expense', EXPENSE_CATEGORIES, 'expense')}
      {renderGroup('Income',  INCOME_CATEGORIES,  'income')}
      {renderGroup('Savings', SAVINGS_CATEGORIES, 'savings')}
    </Section>
  );
}

// ─── 4. Notifications ─────────────────────────────────────────────────────

function NotificationsSection() {
  const { prefs, updateNotifications } = usePreferences();
  const n = prefs.notifications;

  return (
    <Section icon={Bell} title="Notifications">
      <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 4, lineHeight: 1.6 }}>
        Toggles are saved. In-app delivery is active; push notifications require a future update.
      </p>
      <SettingsRow label="Budget alerts" hint="Warn when a category hits 80% of its budget">
        <Toggle checked={n.budgetAlert} onChange={v => updateNotifications({ budgetAlert: v })} />
      </SettingsRow>
      <SettingsRow label="Daily transaction reminder" hint="Nudge if no transaction recorded today">
        <Toggle checked={n.billReminders} onChange={v => updateNotifications({ billReminders: v })} />
      </SettingsRow>
      <SettingsRow label="Weekly digest" hint="Summary of your week's spending">
        <Toggle checked={n.weeklyDigest} onChange={v => updateNotifications({ weeklyDigest: v })} />
      </SettingsRow>
      <SettingsRow label="Goal milestones" hint="Celebrate when a savings goal is reached">
        <Toggle checked={n.goalMilestone} onChange={v => updateNotifications({ goalMilestone: v })} />
      </SettingsRow>
      <SettingsRow label="Large transaction alert" hint={`Alert when a single transaction exceeds the threshold`}>
        <Toggle checked={n.largeTransaction} onChange={v => updateNotifications({ largeTransaction: v })} />
      </SettingsRow>
      {n.largeTransaction && (
        <SettingsRow label="Large transaction threshold">
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
    const header = 'date,description,amount,type,category,account';
    const rows = transactions.map(t => {
      const acct = accounts.find(a => a.id === (t.accountId || t.fromAccountId));
      return [
        t.date,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount,
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
        <td style="text-align:right">${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}</td>
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

function AccountSection({ logout }) {
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
      const uid = auth.currentUser.uid;
      // Delete all subcollections
      for (const col of ['transactions','budgets','accounts','debts','assets','preferences']) {
        const snap  = await getDocs(collection(db, 'users', uid, col));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        if (snap.docs.length) await batch.commit();
      }
      await deleteUser(auth.currentUser);
    } catch (err) {
      setDeleteErr(err.code === 'auth/requires-recent-login'
        ? 'Re-login required before deleting your account.'
        : 'Failed to delete account. Please try again.');
      setDeleteBusy(false);
    }
  };

  return (
    <Section icon={LogOut} title="Account">
      <SettingsRow label="Sign out" hint="End your session and return to the login screen">
        <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={logout}>
          <LogOut size={13} strokeWidth={1.6} /> Sign Out
        </button>
      </SettingsRow>

      <SettingsRow label="Delete account" hint="Permanently delete all your data — this cannot be undone">
        <button type="button" className="btn-ghost"
          style={{ fontSize: 13, color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={() => setShowDelete(true)}>
          <Trash2 size={13} strokeWidth={1.6} /> Delete
        </button>
      </SettingsRow>

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

export default function Settings({ currentUser, logout, transactions, accounts, addTransaction }) {
  // Expose addTransaction for the import confirm callback
  window.__addTransaction = addTransaction;

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Settings</h2>
      </div>
      <div className="settings-layout">
        <ProfileSection currentUser={currentUser} />
        <PreferencesSection />
        <ManageCategoriesSection />
        <NotificationsSection />
        <SecuritySection />
        <DataSection transactions={transactions} accounts={accounts} />
        <AccountSection logout={logout} />
      </div>
    </div>
  );
}
