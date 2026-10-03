import { useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { ACCOUNT_TYPES, ASSET_TYPES, POPULAR_ACCOUNTS } from '../hooks/useFinanceData';
import { ACCOUNT_TYPE_ICONS, ASSET_TYPE_ICONS } from './CategoryIcon';
import { usePreferences, symbolFor } from '../contexts/PreferencesContext';
import CurrencySelect, { BaseApprox } from './CurrencySelect';

// ─── Helpers ───────────────────────────────────────────────────────────────

const getAccountTypeMeta = (typeId) => ACCOUNT_TYPES.find(t => t.id === typeId) || ACCOUNT_TYPES[3];
// assetTypes = built-in + custom investment types from preferences
const getAssetTypeMeta   = (assetTypes, typeId) => assetTypes.find(t => t.id === typeId) || ASSET_TYPES[7];

const COLOR_SWATCHES = [
  '#e41e20','#b31012','#0072bc','#4f46e5','#0ea5e9','#7c3aed',
  '#eab308','#dc2626','#f97316','#22c55e','#14b8a6','#6b7280',
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="color-picker">
      {COLOR_SWATCHES.map(c => (
        <button
          key={c}
          type="button"
          className={`color-swatch ${value === c ? 'selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

// ─── Add / Edit Account Modal ──────────────────────────────────────────────

function AccountModal({ existing, onSave, onClose }) {
  const { baseCurrency } = usePreferences();
  const [name,    setName]    = useState(existing?.name    || '');
  const [currency, setCurrency] = useState(existing?.currency || baseCurrency);
  const [type,    setType]    = useState(existing?.type    || 'bank');
  const [balance, setBalance] = useState(existing?.balance ?? '');
  const [phone,   setPhone]   = useState(existing?.phone   || '');
  const [color,   setColor]   = useState(existing?.color   || '#3b82f6');
  const [busy,    setBusy]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const data = { name: name.trim(), type, phone, color, currency };
    if (!existing) data.balance = parseFloat(balance) || 0;
    await onSave(data);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{existing ? 'Edit Account' : 'Add Account'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Account Name</label>
            <input type="text" placeholder="e.g. Main bank account" value={name}
              onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>Account Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              {ACCOUNT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Currency</label>
            <CurrencySelect value={currency} onChange={setCurrency} />
            {existing && currency !== existing.currency && (
              <p className="fx-hint">The balance number is kept as-is, not converted. Use Reconcile afterwards if it needs correcting.</p>
            )}
          </div>
          {!existing && (
            <div className="form-group">
              <label>Current Balance ({symbolFor(currency)})</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={balance} onChange={e => setBalance(e.target.value)} />
            </div>
          )}
          {type === 'momo' && (
            <div className="form-group">
              <label>Phone Number (optional)</label>
              <input type="tel" placeholder="Phone number" value={phone}
                onChange={e => setPhone(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label>Colour</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {existing ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reconcile (manual balance correction) Modal ──────────────────────────

function ReconcileModal({ account, onSave, onClose }) {
  const [newBalance, setNewBalance] = useState(account.balance ?? '');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onSave(account.id, { balance: parseFloat(newBalance) || 0 });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Reconcile Balance</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Correct the balance for <strong>{account.name}</strong> if it has drifted from reality
            (e.g. you forgot to log a transaction).
          </p>
          <div className="form-group">
            <label>Actual Balance ({symbolFor(account.currency)})</label>
            <input type="number" step="0.01" value={newBalance}
              onChange={e => setNewBalance(e.target.value)} autoFocus required />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>Update Balance</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add / Edit Debt Modal ─────────────────────────────────────────────────

function DebtModal({ existing, onSave, onClose }) {
  const { baseCurrency } = usePreferences();
  const [name,     setName]     = useState(existing?.name           || '');
  const [currency, setCurrency] = useState(existing?.currency       || baseCurrency);
  const [original, setOriginal] = useState(existing?.originalAmount || '');
  const [current,  setCurrent]  = useState(existing?.currentBalance || '');
  const [rate,     setRate]     = useState(existing?.interestRate   || '');
  const [payment,  setPayment]  = useState(existing?.monthlyPayment || '');
  const [dueDate,  setDueDate]  = useState(existing?.dueDate        || '');
  const [notes,    setNotes]    = useState(existing?.notes          || '');
  const [busy,     setBusy]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !current) return;
    setBusy(true);
    await onSave({
      name:           name.trim(),
      currency,
      originalAmount: parseFloat(original) || parseFloat(current),
      currentBalance: parseFloat(current),
      interestRate:   parseFloat(rate)    || null,
      monthlyPayment: parseFloat(payment) || null,
      dueDate:        dueDate || null,
      notes:          notes.trim() || null,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{existing ? 'Edit Debt' : 'Add Debt / Loan'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Debt Name</label>
            <input type="text" placeholder="e.g. Car loan" value={name}
              onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>Currency</label>
            <CurrencySelect value={currency} onChange={setCurrency} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Original Amount ({symbolFor(currency)})</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={original} onChange={e => setOriginal(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Amount Still Owed ({symbolFor(currency)})</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={current} onChange={e => setCurrent(e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Interest Rate % (optional)</label>
              <input type="number" min="0" step="0.1" placeholder="e.g. 18.5"
                value={rate} onChange={e => setRate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Monthly Payment (optional)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={payment} onChange={e => setPayment(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Due Date (optional)</label>
              <input type="month" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <input type="text" placeholder="e.g. Loan from a family member"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {existing ? 'Save Changes' : 'Add Debt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Asset Modal ───────────────────────────────────────────────────────

function AssetModal({ existing, accounts, onSave, onClose }) {
  const { fmtCur, convert, baseCurrency, txFxMeta, assetTypes } = usePreferences();
  const [name,       setName]       = useState(existing?.name         || '');
  const [currency,   setCurrency]   = useState(existing?.currency     || baseCurrency);
  const [assetType,  setAssetType]  = useState(existing?.assetType    || 'tbill');
  const [costBasis,  setCostBasis]  = useState(existing?.costBasis    || '');
  const [currValue,  setCurrValue]  = useState(existing?.currentValue || '');
  const [maturity,   setMaturity]   = useState(existing?.maturityDate || '');
  const [sourceAcct, setSourceAcct] = useState('');
  const [busy,       setBusy]       = useState(false);

  const source     = accounts.find(a => a.id === sourceAcct);
  const crossCur   = source && source.currency !== currency;
  // Cost in the funding account's currency (what actually leaves that account)
  const sourceCost = source && costBasis ? convert(parseFloat(costBasis), currency, source.currency) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !costBasis) return;
    if (crossCur && sourceCost === null) return;
    setBusy(true);
    await onSave(
      {
        name:         name.trim(),
        assetType,
        currency,
        costBasis:    parseFloat(costBasis),
        currentValue: parseFloat(currValue) || parseFloat(costBasis),
        maturityDate: maturity || null,
      },
      sourceAcct || null,
      source ? Math.round(sourceCost * 100) / 100 : undefined,
      source ? txFxMeta(source.currency) : {}
    );
    onClose();
  };


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{existing ? 'Edit Asset' : 'Add Investment / Asset'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Asset Name</label>
            <input type="text" placeholder="e.g. Government bonds" value={name}
              onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>Asset Type</label>
            <select value={assetType} onChange={e => setAssetType(e.target.value)}>
              {assetTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Currency</label>
            <CurrencySelect value={currency} onChange={setCurrency} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Amount Invested / Cost ({symbolFor(currency)})</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={costBasis} onChange={e => setCostBasis(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Current Value ({symbolFor(currency)})</label>
              <input type="number" min="0" step="0.01" placeholder="Same as invested"
                value={currValue} onChange={e => setCurrValue(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Maturity / End Date (optional)</label>
            <input type="date" value={maturity} onChange={e => setMaturity(e.target.value)} />
          </div>
          {!existing && accounts.length > 0 && (
            <div className="form-group">
              <label>Funded from account (deducts balance)</label>
              <select value={sourceAcct} onChange={e => setSourceAcct(e.target.value)}>
                <option value="">— Select account —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({fmtCur(a.balance, a.currency)})</option>
                ))}
              </select>
              {crossCur && costBasis && (
                <p className="fx-hint">
                  {sourceCost === null
                    ? `No ${source.currency}/${currency} rate available. Set one in Settings → Exchange Rates.`
                    : `≈ ${fmtCur(sourceCost, source.currency)} will be deducted from ${source.name}.`}
                </p>
              )}
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy || (crossCur && sourceCost === null)}>
              {existing ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Update Asset Value Modal ──────────────────────────────────────────────

function UpdateValueModal({ asset, onSave, onClose }) {
  const { fmtCur } = usePreferences();
  const fmt = (v) => fmtCur(v, asset.currency);
  const [value, setValue] = useState(asset.currentValue ?? '');
  const [busy,  setBusy]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onSave(asset.id, parseFloat(value));
    onClose();
  };

  const gain = parseFloat(value) - asset.costBasis;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Update Value — {asset.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <p style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
            Cost basis: <strong style={{ color: 'var(--text-1)' }}>{fmt(asset.costBasis)}</strong>
          </p>
          <div className="form-group">
            <label>Current Market Value ({symbolFor(asset.currency)})</label>
            <input type="number" min="0" step="0.01" value={value}
              onChange={e => setValue(e.target.value)} autoFocus required />
          </div>
          {value !== '' && (
            <p style={{ fontSize: 13, color: gain >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {gain >= 0 ? '▲' : '▼'} {fmt(Math.abs(gain))} ({asset.costBasis > 0 ? ((gain / asset.costBasis) * 100).toFixed(1) : 0}%)
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Cash Out Modal ────────────────────────────────────────────────────────

function CashOutModal({ asset, accounts, onCashOut, onClose }) {
  const { fmtCur, convert, txFxMeta } = usePreferences();
  // Suggested payout in the receiving account's currency
  const suggest = (acctId) => {
    const acct = accounts.find(a => a.id === acctId);
    const v    = acct ? convert(asset.currentValue || 0, asset.currency, acct.currency) : asset.currentValue;
    return v === null || v === undefined ? '' : String(Math.round(v * 100) / 100);
  };
  const [toAcct,   setToAcct]   = useState(accounts[0]?.id || '');
  const [amount,   setAmount]   = useState(() => suggest(accounts[0]?.id));
  const [busy,     setBusy]     = useState(false);
  const target = accounts.find(a => a.id === toAcct);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!toAcct || !amount) return;
    setBusy(true);
    await onCashOut(asset.id, parseFloat(amount), toAcct, txFxMeta(target?.currency));
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Cash Out — {asset.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            This will close the asset and credit the received amount to your chosen account.
            Current value: <strong>{fmtCur(asset.currentValue, asset.currency)}</strong>.
          </p>
          <div className="form-group">
            <label>Credit to Account</label>
            <select value={toAcct} onChange={e => { setToAcct(e.target.value); setAmount(suggest(e.target.value)); }} required>
              <option value="">— Select account —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({fmtCur(a.balance, a.currency)})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Amount Received ({symbolFor(target?.currency || asset.currency)})</label>
            <input type="number" min="0" step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} autoFocus required />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>Confirm Cash Out</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Account Activity Modal ────────────────────────────────────────────────

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function AccountActivityModal({ account, accounts, transactions, onClose }) {
  const { fmtCur } = usePreferences();
  const [from, setFrom] = useState('');      // '' = no limit
  const [to,   setTo]   = useState('');
  const [sort, setSort] = useState('newest');
  const acctName = (id) => accounts.find(a => a.id === id)?.name || 'deleted account';

  // Each transaction as it affected THIS account: signed amount in the account's currency
  const rows = transactions
    .filter(t => t.accountId === account.id || t.toAccountId === account.id)
    .filter(t => (!from || t.date >= from) && (!to || t.date <= to))
    .map(t => {
      if (t.type === 'transfer') {
        const incoming = t.toAccountId === account.id;
        return {
          ...t,
          signed: incoming ? (t.toAmount ?? t.amount) : -t.amount,
          detail: incoming ? `Transfer from ${acctName(t.fromAccountId)}` : `Transfer to ${acctName(t.toAccountId)}`,
        };
      }
      return { ...t, signed: t.type === 'income' ? t.amount : -t.amount, detail: t.category };
    })
    .sort((a, b) => sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

  const moneyIn  = rows.filter(r => r.signed > 0).reduce((s, r) => s + r.signed, 0);
  const moneyOut = rows.filter(r => r.signed < 0).reduce((s, r) => s - r.signed, 0);
  const fmt = (v) => fmtCur(v, account.currency);

  const preset = (kind) => {
    const now = new Date();
    if (kind === 'month')  { setFrom(isoDay(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(isoDay(now)); }
    if (kind === '30')     { setFrom(isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29))); setTo(isoDay(now)); }
    if (kind === 'all')    { setFrom(''); setTo(''); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{account.name}</h3>
            <p className="acct-type" style={{ marginTop: 2 }}>
              Balance: <strong style={{ color: 'var(--text-1)' }}>{fmt(account.balance)}</strong> · {account.currency}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="activity-filters">
          <div className="activity-presets">
            <button type="button" className="btn-ghost" onClick={() => preset('month')}>This month</button>
            <button type="button" className="btn-ghost" onClick={() => preset('30')}>Last 30 days</button>
            <button type="button" className="btn-ghost" onClick={() => preset('all')}>All time</button>
          </div>
          <div className="activity-range">
            <label>From<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label>
            <label>To<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label>
            <label>Sort
              <select value={sort} onChange={e => setSort(e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
        </div>

        <div className="activity-summary">
          <span>{rows.length} transaction{rows.length !== 1 ? 's' : ''}</span>
          <span className="pos">In {fmt(moneyIn)}</span>
          <span className="neg">Out {fmt(moneyOut)}</span>
          <span>Net <strong>{fmt(moneyIn - moneyOut)}</strong></span>
        </div>

        <div className="activity-list">
          {rows.length === 0 ? (
            <p className="accounts-empty" style={{ textAlign: 'center' }}>No transactions in this period.</p>
          ) : rows.map(r => (
            <div key={r.id} className="activity-row">
              <span className="activity-date">
                {new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <div className="activity-desc">
                <span>{r.description}</span>
                <small>{r.detail}</small>
              </div>
              <span className={`activity-amt ${r.signed >= 0 ? 'pos' : 'neg'}`}>
                {r.signed >= 0 ? '+' : '-'}{fmt(Math.abs(r.signed))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Account Card ──────────────────────────────────────────────────────────

function AccountCard({ account, onEdit, onDelete, onReconcile, onOpen }) {
  const { fmtCur } = usePreferences();
  const Icon = ACCOUNT_TYPE_ICONS[account.type] || ACCOUNT_TYPE_ICONS.other;
  const meta = getAccountTypeMeta(account.type);

  return (
    <div className="acct-card acct-card--clickable" role="button" tabIndex={0}
      title="View transactions"
      onClick={() => onOpen(account)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(account); } }}>
      <div className="acct-card-left">
        <span className="acct-icon" style={{ background: `${account.color}22`, border: `1px solid ${account.color}44` }}>
          <Icon size={18} strokeWidth={1.5} className="ico" />
        </span>
        <div>
          <p className="acct-name">{account.name}</p>
          <p className="acct-type">{meta.label} · {account.currency}{account.phone ? ` · ${account.phone}` : ''}</p>
        </div>
      </div>
      <div className="acct-card-right">
        <div className="acct-balance-wrap">
          <p className="acct-balance" style={{ color: account.balance >= 0 ? 'var(--text-1)' : 'var(--danger)' }}>
            {fmtCur(account.balance, account.currency)}
          </p>
          <BaseApprox amount={account.balance} currency={account.currency} />
        </div>
        {/* Buttons keep their own actions instead of opening the activity window */}
        <div className="acct-actions" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <button className="icon-btn" onClick={() => onReconcile(account)} title="Reconcile balance"><RefreshCw size={13} strokeWidth={1.6} /></button>
          <button className="icon-btn" onClick={() => onEdit(account)} title="Edit"><Pencil size={13} strokeWidth={1.6} /></button>
          <button className="icon-btn delete-btn" onClick={() => onDelete(account.id)} title="Delete"><Trash2 size={13} strokeWidth={1.6} /></button>
        </div>
      </div>
    </div>
  );
}

// ─── Debt Card ─────────────────────────────────────────────────────────────

function DebtCard({ debt, onEdit, onDelete }) {
  const { fmtCur } = usePreferences();
  const fmt = (v) => fmtCur(v, debt.currency);
  const original = debt.originalAmount || debt.currentBalance;
  const paid     = Math.max(0, original - debt.currentBalance);
  const pct      = original > 0 ? Math.min((paid / original) * 100, 100) : 0;

  return (
    <div className="debt-card">
      <div className="debt-card-header">
        <div>
          <p className="debt-name">{debt.name}</p>
          {debt.interestRate && <p className="debt-meta">{debt.interestRate}% interest{debt.dueDate ? ` · Due ${debt.dueDate}` : ''}</p>}
        </div>
        <div className="acct-actions">
          <button className="icon-btn" onClick={() => onEdit(debt)} title="Edit"><Pencil size={13} strokeWidth={1.6} /></button>
          <button className="icon-btn delete-btn" onClick={() => onDelete(debt.id)} title="Delete"><Trash2 size={13} strokeWidth={1.6} /></button>
        </div>
      </div>
      <div className="debt-progress-wrap">
        <div className="progress-bar-wrap" style={{ height: 6 }}>
          <div className="progress-bar-fill" style={{ width: `${pct}%`, background: 'var(--success)' }} />
        </div>
        <div className="debt-amounts">
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{pct.toFixed(0)}% paid off</span>
          <span style={{ color: 'var(--danger)', fontWeight: 600, textAlign: 'right' }}>
            {fmt(debt.currentBalance)} remaining
            <BaseApprox amount={debt.currentBalance} currency={debt.currency} />
          </span>
        </div>
      </div>
      {debt.monthlyPayment && (
        <p className="debt-meta" style={{ marginTop: 4 }}>Monthly payment: {fmt(debt.monthlyPayment)}</p>
      )}
    </div>
  );
}

// ─── Asset Card ────────────────────────────────────────────────────────────

function AssetCard({ asset, onUpdateValue, onCashOut, onDelete }) {
  const { fmtCur, assetTypes } = usePreferences();
  const fmt = (v) => fmtCur(v, asset.currency);
  const Icon = ASSET_TYPE_ICONS[asset.assetType] || ASSET_TYPE_ICONS.other;
  const meta = getAssetTypeMeta(assetTypes, asset.assetType);
  const gain = asset.currentValue - asset.costBasis;
  const gainPct = asset.costBasis > 0 ? ((gain / asset.costBasis) * 100).toFixed(1) : 0;

  return (
    <div className="asset-card">
      <div className="asset-card-header">
        <div className="asset-card-left">
          <span className="acct-icon" style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}44` }}>
            <Icon size={18} strokeWidth={1.5} className="ico" />
          </span>
          <div>
            <p className="acct-name">{asset.name}</p>
            <p className="acct-type">{meta.label}{asset.maturityDate ? ` · Matures ${new Date(asset.maturityDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
          </div>
        </div>
        <button className="icon-btn delete-btn" onClick={() => onDelete(asset.id)} title="Delete"><Trash2 size={13} strokeWidth={1.6} /></button>
      </div>

      <div className="asset-values">
        <div className="asset-val-row">
          <span className="asset-val-label">Invested</span>
          <span className="asset-val">{fmt(asset.costBasis)}</span>
        </div>
        <div className="asset-val-row">
          <span className="asset-val-label">Current Value</span>
          <span className="asset-val" style={{ color: 'var(--text-1)', fontWeight: 700, textAlign: 'right' }}>
            {fmt(asset.currentValue)}
            <BaseApprox amount={asset.currentValue} currency={asset.currency} />
          </span>
        </div>
        <div className="asset-val-row">
          <span className="asset-val-label">Gain / Loss</span>
          <span className="asset-val" style={{ color: gain >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct}%)
          </span>
        </div>
      </div>

      <div className="asset-card-actions">
        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => onUpdateValue(asset)}>
          Update Value
        </button>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--success)' }} onClick={() => onCashOut(asset)}>
          Cash Out
        </button>
      </div>
    </div>
  );
}

// ─── Transfer Modal ────────────────────────────────────────────────────────

function TransferModal({ accounts, onTransfer, onClose }) {
  const { fmtCur, convert, txFxMeta } = usePreferences();
  const today = new Date().toISOString().slice(0, 10);
  const [fromId, setFromId] = useState('');
  const [toId,   setToId]   = useState('');
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState('');   // only used for cross-currency transfers
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [desc,   setDesc]   = useState('');
  const [date,   setDate]   = useState(today);
  const [error,  setError]  = useState('');
  const [busy,   setBusy]   = useState(false);

  const fromAcct = accounts.find(a => a.id === fromId);
  const toAcct   = accounts.find(a => a.id === toId);
  const crossCur = fromAcct && toAcct && fromAcct.currency !== toAcct.currency;

  // Pre-fill the received amount from today's rate until the user types their own
  const suggestReceived = (amt, from, to) => {
    if (!from || !to || from.currency === to.currency || !amt) return '';
    const v = convert(parseFloat(amt), from.currency, to.currency);
    return v === null ? '' : String(Math.round(v * 100) / 100);
  };
  const refresh = (amt, fId, tId) => {
    if (receivedTouched) return;
    setReceived(suggestReceived(amt, accounts.find(a => a.id === fId), accounts.find(a => a.id === tId)));
  };

  const sent = parseFloat(amount), got = parseFloat(received);
  const impliedRate = crossCur && sent > 0 && got > 0 ? got / sent : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromId || !toId || fromId === toId || !amount) return;
    if (crossCur && !(got > 0)) { setError(`Enter how much arrived in ${toAcct.name}.`); return; }
    if (fromAcct && sent > fromAcct.balance) {
      setError(`Insufficient balance. ${fromAcct.name} only has ${fmtCur(fromAcct.balance, fromAcct.currency)}.`);
      return;
    }
    setBusy(true);
    try {
      await onTransfer({
        ...txFxMeta(fromAcct.currency),
        fromAccountId: fromId,
        toAccountId:   toId,
        amount:        sent,
        ...(crossCur ? { toAmount: got, toCurrency: toAcct.currency } : {}),
        description:   desc.trim() || 'Transfer',
        date,
      });
      onClose();
    } catch (err) {
      setError(`Transfer failed: ${err.message || 'Unknown error'}`);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Transfer Funds</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>From Account</label>
            <select value={fromId} onChange={e => { setFromId(e.target.value); setError(''); refresh(amount, e.target.value, toId); }} required>
              <option value="">— Select account —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({fmtCur(a.balance, a.currency)})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>To Account</label>
            <select value={toId} onChange={e => { setToId(e.target.value); setError(''); refresh(amount, fromId, e.target.value); }} required>
              <option value="">— Select account —</option>
              {accounts.filter(a => a.id !== fromId).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({fmtCur(a.balance, a.currency)})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{crossCur ? 'Amount Sent' : 'Amount'} ({symbolFor(fromAcct?.currency)})</label>
              <input type="number" min="0.01" step="0.01" placeholder="0.00"
                value={amount} onChange={e => { setAmount(e.target.value); setError(''); refresh(e.target.value, fromId, toId); }} required />
            </div>
            {crossCur ? (
              <div className="form-group">
                <label>Amount Received ({symbolFor(toAcct.currency)})</label>
                <input type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={received} onChange={e => { setReceived(e.target.value); setReceivedTouched(true); setError(''); }} required />
              </div>
            ) : (
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
            )}
          </div>
          {crossCur && (
            <>
              <p className="fx-hint">
                {impliedRate
                  ? `Rate you got: 1 ${fromAcct.currency} = ${impliedRate.toFixed(4)} ${toAcct.currency}. `
                  : ''}
                Pre-filled from today's rate. Change it to exactly what arrived, fees included.
              </p>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
            </>
          )}
          <div className="form-group">
            <label>Description (optional)</label>
            <input type="text" placeholder="e.g. Moving money to savings"
              value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          {error && <p className="transfer-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary"
              disabled={busy || !fromId || !toId || fromId === toId || !amount}>
              Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Group tile (Cash / Debts / Investments): summary that expands its items ─

function GroupTile({ id, title, count, noun, open, onToggle, onAdd, addTitle, children }) {
  return (
    <div className={`group-card ${open ? 'active' : ''}`} role="button" tabIndex={0}
      aria-expanded={open}
      onClick={() => onToggle(id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(id); } }}>
      <div className="bg-head">
        <span className="bg-title">{title}</span>
        <span className="bg-head-right">
          <span className="bg-count">
            {count} {count === 1 ? noun : `${noun}s`}
            <ChevronRight size={13} strokeWidth={1.8} className="bg-chevron" />
          </span>
          <button type="button" className="icon-btn bg-add" title={addTitle}
            onClick={e => { e.stopPropagation(); onAdd(); }}
            onKeyDown={e => e.stopPropagation()}>
            <Plus size={14} strokeWidth={1.8} />
          </button>
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── Main Accounts Page ────────────────────────────────────────────────────

export default function Accounts({ accounts, debts, assets, transactions = [], missingRates = [], addAccount, updateAccount, deleteAccount, addDebt, updateDebt, deleteDebt, addAsset, updateAssetValue, cashOutAsset, deleteAsset, addTransfer }) {
  const { fmt, fmtCur, baseCurrency, toBase } = usePreferences();
  const [modal, setModal] = useState(null); // { type, data? }
  const close = () => setModal(null);

  // ── Totals per group, in the base currency ────────────────────────────
  const activeAssets = assets.filter(a => a.status === 'active');
  const openDebts    = debts.filter(d => d.status !== 'paid');
  const base = (amount, cur) => toBase(amount || 0, cur) ?? 0;

  const totalCash        = accounts.reduce((s, a) => s + (a.baseBalance || 0), 0);
  const totalDebts       = openDebts.reduce((s, d) => s + (d.baseBalance || 0), 0);
  const totalBorrowed    = openDebts.reduce((s, d) => s + base(d.originalAmount || d.currentBalance, d.currency), 0);
  const monthlyPayments  = openDebts.reduce((s, d) => s + base(d.monthlyPayment, d.currency), 0);
  const paidPct          = totalBorrowed > 0 ? Math.max(0, Math.min(100, (1 - totalDebts / totalBorrowed) * 100)) : 0;
  const totalInvested    = activeAssets.reduce((s, a) => s + base(a.costBasis, a.currency), 0);
  const totalInvestments = activeAssets.reduce((s, a) => s + (a.baseValue || 0), 0);
  const investGain       = totalInvestments - totalInvested;
  const netWorth         = totalCash + totalInvestments - totalDebts;

  // Cash held per currency, base currency first (shown on the Cash tile)
  const cashByCurrency = Object.entries(
    accounts.reduce((m, a) => ({ ...m, [a.currency]: (m[a.currency] || 0) + (a.balance || 0) }), {})
  ).sort(([a], [b]) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : a.localeCompare(b)));

  // Which group's items are showing; all collapsed at first
  const [openGroup, setOpenGroup] = useState(null);
  const toggle = (g) => setOpenGroup(cur => (cur === g ? null : g));

  return (
    <div className="accounts-page">
      <div className="page-header">
        <h2>Accounts</h2>
        <div className="page-header-actions">
          {accounts.length >= 2 && (
            <button className="btn-ghost" onClick={() => setModal({ type: 'transfer' })}>
              <ArrowLeftRight size={14} strokeWidth={1.6} className="ico" /> Transfer
            </button>
          )}
          <button className="btn-pill" onClick={() => setModal({ type: 'account' })}>
            + Add Account
          </button>
        </div>
      </div>

      {/* ── Net worth (the group tiles below carry the breakdown) ── */}
      <div className="net-worth-hero">
        <div className="nw-main">
          <span className="nw-label">Total Net Worth</span>
          <span className={`nw-value ${netWorth >= 0 ? '' : 'neg'}`}>{fmt(netWorth)}</span>
          <span className="nw-sub">Cash + investments − debts, in {baseCurrency}</span>
        </div>
      </div>

      {missingRates.length > 0 && (
        <p className="fx-warning">
          No exchange rate available for {missingRates.join(', ')}. Those amounts are left out of the totals.
          Set a rate in Settings → Exchange Rates.
        </p>
      )}

      <div className="group-grid">
        {/* ── Cash Accounts ── */}
        <GroupTile id="cash" open={openGroup === 'cash'} onToggle={toggle} title="Cash Accounts" count={accounts.length} noun="account"
          onAdd={() => setModal({ type: 'account' })} addTitle="Add account">
          {accounts.length === 0 ? (
            <span className="bg-empty">No accounts yet</span>
          ) : (
            <>
              <div>
                <span className="bs-label">Total</span>
                <span className="bg-val" style={{ display: 'block', fontSize: 20 }}>{fmt(totalCash)}</span>
              </div>
              {cashByCurrency.length > 1 && (
                <div className="bg-chips">
                  {cashByCurrency.map(([cur, amt]) => (
                    <span key={cur} className="fx-chip">{fmtCur(amt, cur)}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </GroupTile>
        {openGroup === 'cash' && (
          <div className="group-panel">
            {accounts.length === 0 ? (
              <p className="accounts-empty">No accounts yet. Add one to get started.</p>
            ) : (
              <div className="acct-list">
                {accounts.map(a => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    onEdit={acct => setModal({ type: 'account', data: acct })}
                    onDelete={deleteAccount}
                    onReconcile={acct => setModal({ type: 'reconcile', data: acct })}
                    onOpen={acct => setModal({ type: 'activity', data: acct })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Debts & Loans ── */}
        <GroupTile id="debts" open={openGroup === 'debts'} onToggle={toggle} title="Debts & Loans" count={openDebts.length} noun="debt"
          onAdd={() => setModal({ type: 'debt' })} addTitle="Add debt">
          {openDebts.length === 0 ? (
            <span className="bg-empty">No debts recorded</span>
          ) : (
            <>
              <div className="bg-figures">
                <div><span className="bs-label">Owed</span><span className="bg-val bad">{fmt(totalDebts)}</span></div>
                <div><span className="bs-label">Paid off</span><span className="bg-val">{Math.round(paidPct)}%</span></div>
                <div><span className="bs-label">Monthly</span><span className="bg-val">{monthlyPayments > 0 ? fmt(monthlyPayments) : '—'}</span></div>
              </div>
              <div className="bg-progress">
                <div className="progress-bar-wrap" style={{ height: 6 }}>
                  <div className="progress-bar-fill" style={{ width: `${paidPct}%`, background: 'var(--success)' }} />
                </div>
              </div>
            </>
          )}
        </GroupTile>
        {openGroup === 'debts' && (
          <div className="group-panel">
            {debts.length === 0 ? (
              <p className="accounts-empty">No debts recorded. Add a loan or informal debt to track it.</p>
            ) : (
              <div className="acct-list">
                {debts.map(d => (
                  <DebtCard
                    key={d.id}
                    debt={d}
                    onEdit={debt => setModal({ type: 'debt', data: debt })}
                    onDelete={deleteDebt}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Investments & Assets ── */}
        <GroupTile id="assets" open={openGroup === 'assets'} onToggle={toggle} title="Investments & Assets" count={activeAssets.length} noun="asset"
          onAdd={() => setModal({ type: 'asset' })} addTitle="Add asset">
          {activeAssets.length === 0 ? (
            <span className="bg-empty">No investments tracked</span>
          ) : (
            <div className="bg-figures">
              <div><span className="bs-label">Invested</span><span className="bg-val">{fmt(totalInvested)}</span></div>
              <div><span className="bs-label">Value</span><span className="bg-val">{fmt(totalInvestments)}</span></div>
              <div>
                <span className="bs-label">Gain / loss</span>
                <span className={`bg-val ${investGain >= 0 ? 'good' : 'bad'}`}>
                  {investGain >= 0 ? '+' : '−'}{fmt(Math.abs(investGain))}
                </span>
              </div>
            </div>
          )}
        </GroupTile>
        {openGroup === 'assets' && (
          <div className="group-panel">
            {activeAssets.length === 0 ? (
              <p className="accounts-empty">No assets tracked yet. Add a treasury bill, property, or any investment.</p>
            ) : (
              <div className="asset-grid">
                {activeAssets.map(a => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    onUpdateValue={asset => setModal({ type: 'updateValue', data: asset })}
                    onCashOut={asset => setModal({ type: 'cashOut', data: asset })}
                    onDelete={deleteAsset}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal?.type === 'account' && (
        <AccountModal
          existing={modal.data}
          onSave={modal.data
            ? (updates) => updateAccount(modal.data.id, updates)
            : addAccount}
          onClose={close}
        />
      )}
      {modal?.type === 'activity' && (
        <AccountActivityModal
          // Look up the live account so the balance updates if it changes while open
          account={accounts.find(a => a.id === modal.data.id) || modal.data}
          accounts={accounts} transactions={transactions} onClose={close}
        />
      )}
      {modal?.type === 'reconcile' && (
        <ReconcileModal account={modal.data} onSave={updateAccount} onClose={close} />
      )}
      {modal?.type === 'debt' && (
        <DebtModal
          existing={modal.data}
          onSave={modal.data
            ? (updates) => updateDebt(modal.data.id, updates)
            : addDebt}
          onClose={close}
        />
      )}
      {modal?.type === 'asset' && (
        <AssetModal existing={modal.data} accounts={accounts} onSave={addAsset} onClose={close} />
      )}
      {modal?.type === 'transfer' && (
        <TransferModal accounts={accounts} onTransfer={addTransfer} onClose={close} />
      )}
      {modal?.type === 'updateValue' && (
        <UpdateValueModal asset={modal.data} onSave={updateAssetValue} onClose={close} />
      )}
      {modal?.type === 'cashOut' && (
        <CashOutModal asset={modal.data} accounts={accounts} onCashOut={cashOutAsset} onClose={close} />
      )}
    </div>
  );
}
