import { useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { ACCOUNT_TYPES, ASSET_TYPES, POPULAR_ACCOUNTS } from '../hooks/useFinanceData';
import { ACCOUNT_TYPE_ICONS, ASSET_TYPE_ICONS } from './CategoryIcon';
import { fmt } from '../utils';

// ─── Helpers ───────────────────────────────────────────────────────────────

const getAccountTypeMeta = (typeId) => ACCOUNT_TYPES.find(t => t.id === typeId) || ACCOUNT_TYPES[3];
const getAssetTypeMeta   = (typeId) => ASSET_TYPES.find(t => t.id === typeId)   || ASSET_TYPES[7];

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
  const [name,    setName]    = useState(existing?.name    || '');
  const [type,    setType]    = useState(existing?.type    || 'bank');
  const [balance, setBalance] = useState(existing?.balance ?? '');
  const [phone,   setPhone]   = useState(existing?.phone   || '');
  const [color,   setColor]   = useState(existing?.color   || '#3b82f6');
  const [busy,    setBusy]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onSave({ name: name.trim(), type, balance: parseFloat(balance) || 0, phone, color, currency: 'GHS' });
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
            <input type="text" placeholder="e.g. MTN MoMo" value={name}
              onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>Account Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              {ACCOUNT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          {!existing && (
            <div className="form-group">
              <label>Current Balance (GH₵)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={balance} onChange={e => setBalance(e.target.value)} />
            </div>
          )}
          {type === 'momo' && (
            <div className="form-group">
              <label>Phone Number (optional)</label>
              <input type="tel" placeholder="024 000 0000" value={phone}
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
            <label>Actual Balance (GH₵)</label>
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
  const [name,     setName]     = useState(existing?.name           || '');
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
            <input type="text" placeholder="e.g. Stanbic personal loan" value={name}
              onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Original Amount (GH₵)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={original} onChange={e => setOriginal(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Amount Still Owed (GH₵)</label>
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
            <input type="text" placeholder="e.g. Family loan from Uncle Kofi"
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
  const [name,       setName]       = useState(existing?.name         || '');
  const [assetType,  setAssetType]  = useState(existing?.assetType    || 'tbill');
  const [costBasis,  setCostBasis]  = useState(existing?.costBasis    || '');
  const [currValue,  setCurrValue]  = useState(existing?.currentValue || '');
  const [maturity,   setMaturity]   = useState(existing?.maturityDate || '');
  const [sourceAcct, setSourceAcct] = useState('');
  const [busy,       setBusy]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !costBasis) return;
    setBusy(true);
    await onSave(
      {
        name:         name.trim(),
        assetType,
        costBasis:    parseFloat(costBasis),
        currentValue: parseFloat(currValue) || parseFloat(costBasis),
        maturityDate: maturity || null,
      },
      sourceAcct || null
    );
    onClose();
  };

  const meta = getAssetTypeMeta(assetType);

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
            <input type="text" placeholder="e.g. Treasury Bills – GCB" value={name}
              onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>Asset Type</label>
            <select value={assetType} onChange={e => setAssetType(e.target.value)}>
              {ASSET_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Amount Invested / Cost (GH₵)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={costBasis} onChange={e => setCostBasis(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Current Value (GH₵)</label>
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
                  <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance)})</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
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
            <label>Current Market Value (GH₵)</label>
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
  const [amount,   setAmount]   = useState(asset.currentValue ?? '');
  const [toAcct,   setToAcct]   = useState(accounts[0]?.id || '');
  const [busy,     setBusy]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!toAcct || !amount) return;
    setBusy(true);
    await onCashOut(asset.id, parseFloat(amount), toAcct);
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
          </p>
          <div className="form-group">
            <label>Amount Received (GH₵)</label>
            <input type="number" min="0" step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>Credit to Account</label>
            <select value={toAcct} onChange={e => setToAcct(e.target.value)} required>
              <option value="">— Select account —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance)})</option>
              ))}
            </select>
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

// ─── Account Card ──────────────────────────────────────────────────────────

function AccountCard({ account, onEdit, onDelete, onReconcile }) {
  const Icon = ACCOUNT_TYPE_ICONS[account.type] || ACCOUNT_TYPE_ICONS.other;
  const meta = getAccountTypeMeta(account.type);

  return (
    <div className="acct-card">
      <div className="acct-card-left">
        <span className="acct-icon" style={{ background: `${account.color}22`, border: `1px solid ${account.color}44` }}>
          <Icon size={18} strokeWidth={1.5} color="#c8ddd5" />
        </span>
        <div>
          <p className="acct-name">{account.name}</p>
          <p className="acct-type">{meta.label}{account.phone ? ` · ${account.phone}` : ''}</p>
        </div>
      </div>
      <div className="acct-card-right">
        <p className="acct-balance" style={{ color: account.balance >= 0 ? 'var(--text-1)' : 'var(--danger)' }}>
          {fmt(account.balance)}
        </p>
        <div className="acct-actions">
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
          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(debt.currentBalance)} remaining</span>
        </div>
      </div>
      {debt.monthlyPayment && (
        <p className="debt-meta" style={{ marginTop: 4 }}>Monthly payment: {fmt(debt.monthlyPayment)}</p>
      )}
    </div>
  );
}

// ─── Asset Card ────────────────────────────────────────────────────────────

function AssetCard({ asset, accounts, onUpdateValue, onCashOut, onDelete }) {
  const Icon = ASSET_TYPE_ICONS[asset.assetType] || ASSET_TYPE_ICONS.other;
  const meta = getAssetTypeMeta(asset.assetType);
  const gain = asset.currentValue - asset.costBasis;
  const gainPct = asset.costBasis > 0 ? ((gain / asset.costBasis) * 100).toFixed(1) : 0;

  return (
    <div className="asset-card">
      <div className="asset-card-header">
        <div className="asset-card-left">
          <span className="acct-icon" style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}44` }}>
            <Icon size={18} strokeWidth={1.5} color="#c8ddd5" />
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
          <span className="asset-val" style={{ color: 'var(--text-1)', fontWeight: 700 }}>{fmt(asset.currentValue)}</span>
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
  const today = new Date().toISOString().slice(0, 10);
  const [fromId, setFromId] = useState('');
  const [toId,   setToId]   = useState('');
  const [amount, setAmount] = useState('');
  const [desc,   setDesc]   = useState('');
  const [date,   setDate]   = useState(today);
  const [error,  setError]  = useState('');
  const [busy,   setBusy]   = useState(false);

  const fromAcct = accounts.find(a => a.id === fromId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromId || !toId || fromId === toId || !amount) return;
    if (fromAcct && parseFloat(amount) > fromAcct.balance) {
      setError(`Insufficient balance. ${fromAcct.name} only has ${fmt(fromAcct.balance)}.`);
      return;
    }
    setBusy(true);
    await onTransfer({
      fromAccountId: fromId,
      toAccountId:   toId,
      amount:        parseFloat(amount),
      description:   desc.trim() || 'Transfer',
      date,
    });
    onClose();
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
            <select value={fromId} onChange={e => { setFromId(e.target.value); setError(''); }} required>
              <option value="">— Select account —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance)})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>To Account</label>
            <select value={toId} onChange={e => { setToId(e.target.value); setError(''); }} required>
              <option value="">— Select account —</option>
              {accounts.filter(a => a.id !== fromId).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance)})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Amount (GH₵)</label>
              <input type="number" min="0.01" step="0.01" placeholder="0.00"
                value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} required />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input type="text" placeholder="e.g. Moving savings to MoMo"
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

// ─── Main Accounts Page ────────────────────────────────────────────────────

export default function Accounts({ accounts, debts, assets, addAccount, updateAccount, deleteAccount, addDebt, updateDebt, deleteDebt, addAsset, updateAssetValue, cashOutAsset, deleteAsset, addTransfer }) {
  const [modal, setModal] = useState(null); // { type, data? }
  const close = () => setModal(null);

  // ── Net worth calculation ──────────────────────────────────────────────
  const totalCash        = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalDebts       = debts.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.currentBalance || 0), 0);
  const totalInvestments = assets.filter(a => a.status === 'active').reduce((s, a) => s + (a.currentValue || 0), 0);
  const netWorth         = totalCash + totalInvestments - totalDebts;

  const activeAssets = assets.filter(a => a.status === 'active');

  return (
    <div className="accounts-page">
      <div className="page-header">
        <h2>Accounts</h2>
        <div className="page-header-actions">
          {accounts.length >= 2 && (
            <button className="btn-ghost" onClick={() => setModal({ type: 'transfer' })}>
              <ArrowLeftRight size={14} strokeWidth={1.6} color="#c8ddd5" /> Transfer
            </button>
          )}
          <button className="btn-pill" onClick={() => setModal({ type: 'account' })}>
            + Add Account
          </button>
        </div>
      </div>

      {/* ── Net Worth Hero ── */}
      <div className="net-worth-hero">
        <div className="nw-main">
          <span className="nw-label">Total Net Worth</span>
          <span className={`nw-value ${netWorth >= 0 ? '' : 'neg'}`}>{fmt(netWorth)}</span>
        </div>
        <div className="nw-breakdown">
          <div className="nw-item">
            <TrendingUp size={14} strokeWidth={1.5} color="#c8ddd5" />
            <span className="nw-item-label">Cash</span>
            <span className="nw-item-val" style={{ color: 'var(--success)' }}>{fmt(totalCash)}</span>
          </div>
          <div className="nw-item">
            <TrendingUp size={14} strokeWidth={1.5} color="#c8ddd5" />
            <span className="nw-item-label">Investments</span>
            <span className="nw-item-val" style={{ color: 'var(--info)' }}>{fmt(totalInvestments)}</span>
          </div>
          <div className="nw-item">
            <TrendingDown size={14} strokeWidth={1.5} color="#c8ddd5" />
            <span className="nw-item-label">Debts</span>
            <span className="nw-item-val" style={{ color: 'var(--danger)' }}>-{fmt(totalDebts)}</span>
          </div>
        </div>
      </div>

      {/* ── Cash Accounts ── */}
      <div className="accounts-section">
        <div className="section-header">
          <h3>Cash Accounts</h3>
          <button className="icon-btn" onClick={() => setModal({ type: 'account' })} title="Add account">
            <Plus size={15} strokeWidth={1.6} />
          </button>
        </div>
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
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Debts ── */}
      <div className="accounts-section">
        <div className="section-header">
          <h3>Debts & Loans</h3>
          <button className="icon-btn" onClick={() => setModal({ type: 'debt' })} title="Add debt">
            <Plus size={15} strokeWidth={1.6} />
          </button>
        </div>
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

      {/* ── Investments & Assets ── */}
      <div className="accounts-section">
        <div className="section-header">
          <h3>Investments & Assets</h3>
          <button className="icon-btn" onClick={() => setModal({ type: 'asset' })} title="Add asset">
            <Plus size={15} strokeWidth={1.6} />
          </button>
        </div>
        {activeAssets.length === 0 ? (
          <p className="accounts-empty">No assets tracked yet. Add a treasury bill, property, or any investment.</p>
        ) : (
          <div className="asset-grid">
            {activeAssets.map(a => (
              <AssetCard
                key={a.id}
                asset={a}
                accounts={accounts}
                onUpdateValue={asset => setModal({ type: 'updateValue', data: asset })}
                onCashOut={asset => setModal({ type: 'cashOut', data: asset })}
                onDelete={deleteAsset}
              />
            ))}
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
