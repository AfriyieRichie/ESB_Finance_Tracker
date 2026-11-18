import { useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { ACCOUNT_TYPES, ASSET_TYPES, POPULAR_ACCOUNTS, assetUsesUnits } from '../hooks/useFinanceData';
import { ACCOUNT_TYPE_ICONS, ASSET_TYPE_ICONS } from './CategoryIcon';
import { usePreferences, symbolFor } from '../contexts/PreferencesContext';
import CurrencySelect, { BaseApprox } from './CurrencySelect';
import { ProjectCard, ProjectFormModal, ProjectDetailModal } from './Projects';
import { projectStats } from '../projects';
import { isPaidOff, repaymentHistory } from '../debts';
import { newestFirst, oldestFirst } from '../txOrder';
import { LendCard, LendFormModal, LendRepayModal, LendMoreModal } from './Lends';
import { lendOutstanding, isLendOverdue } from '../lends';
import { useConfirm } from './Confirm';

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmtUnits = (n) => Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 6 });
const fmtShortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// An investment's purchases and withdrawals, oldest first (amounts in the investment's currency).
// Anything held that no transaction explains (e.g. added without a funding account) shows as a
// starting position.
function assetHistory(asset, transactions) {
  const rows = transactions
    .filter(t => t.assetId === asset.id && (t.type === 'savings' || t.type === 'assetout'))
    .sort(oldestFirst)
    .map(t => (t.type === 'savings'
      ? { id: t.id, date: t.date, action: 'Bought', units: Number(t.assetUnits) || 0, amount: t.assetAmount ?? t.amount, cost: t.assetAmount ?? t.amount }
      : { id: t.id, date: t.date, action: t.assetBefore ? 'Cashed out' : 'Withdrew', units: -(Number(t.assetUnits) || 0),
          amount: t.assetAmount || 0, cost: -(t.assetCost || 0), gain: (t.assetAmount || 0) - (t.assetCost || 0) }));
  if (asset.status === 'active') {
    const cost  = (asset.costBasis || 0) - rows.reduce((s, r) => s + r.cost, 0);
    const units = (Number(asset.units) || 0) - rows.reduce((s, r) => s + r.units, 0);
    if (cost > 0.005 || units > 0.000001) rows.unshift({ id: 'start', date: null, action: 'Starting position', units: Math.max(units, 0), amount: Math.max(cost, 0) });
  }
  return rows;
}

function AssetHistoryTable({ asset, rows }) {
  const { fmtCur } = usePreferences();
  const fmt = (v) => fmtCur(v, asset.currency);
  const shares = (n) => `${fmtUnits(Math.abs(n))} ${Math.abs(n) === 1 ? 'share' : 'shares'}`;
  return (
    <ul className="asset-history">
      {rows.map(r => (
        <li key={r.id}>
          <div className="ah-main">
            <span>{r.action}{r.units ? ` ${shares(r.units)}` : ''}</span>
            <strong>{fmt(r.amount)}</strong>
          </div>
          <div className="ah-sub">
            <span>{r.date ? fmtShortDate(r.date) : 'Before tracking began'}{r.units ? ` · ${fmt(r.amount / Math.abs(r.units))} per share` : ''}</span>
            {r.gain ? <span className={r.gain > 0 ? 'hist-gain' : 'hist-loss'}>{r.gain > 0 ? '+' : '−'}{fmt(Math.abs(r.gain))} {r.gain > 0 ? 'gain' : 'loss'}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

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

// Tick box for money you're holding on someone else's behalf (excluded from net worth)
function HeldToggle({ checked, onChange }) {
  return (
    <label className="held-check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>
        <b>Money held for others (not mine)</b>
        <small>e.g. tithe set aside for church. The balance is tracked but left out of your net worth.</small>
      </span>
    </label>
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
  const [held,    setHeld]    = useState(!!existing?.heldForOthers);
  const [busy,    setBusy]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const data = { name: name.trim(), type, phone, color, currency, heldForOthers: held };
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
          <HeldToggle checked={held} onChange={setHeld} />
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

function DebtModal({ existing, accounts = [], transactions = [], onSave, onClose }) {
  const { baseCurrency, convert, fmtCur, txFxMeta } = usePreferences();
  const today = new Date().toISOString().slice(0, 10);
  // Cash-in: optional for a new loan, or for an existing one that has none recorded yet
  const receivedTx  = existing ? transactions.find(t => t.loanDebtId === existing.id) : null;
  const [recvAcct,  setRecvAcct]  = useState('');
  const [recvAmt,   setRecvAmt]   = useState('');
  const [recvTouched, setRecvTouched] = useState(false);
  const [recvDate,  setRecvDate]  = useState(today);
  const [name,     setName]     = useState(existing?.name           || '');
  const [currency, setCurrency] = useState(existing?.currency       || baseCurrency);
  const [principal, setPrincipal] = useState(existing?.principal ?? '');   // cash actually borrowed
  const [original, setOriginal] = useState(existing?.originalAmount || '');   // total to repay incl. interest
  const [current,  setCurrent]  = useState(existing?.currentBalance || '');
  // An auto-computed rate stays automatic when editing (so it follows changes to the amounts)
  const [rate,     setRate]     = useState(existing?.interestAuto ? '' : (existing?.interestRate || ''));
  const [payment,  setPayment]  = useState(existing?.monthlyPayment || '');
  const [dueDate,  setDueDate]  = useState(existing?.dueDate        || '');
  const [notes,    setNotes]    = useState(existing?.notes          || '');
  const [busy,     setBusy]     = useState(false);

  // Pre-fill the amount received from the loan amount, converted into the account's currency
  const suggestRecv = (acctId, borrowed = principal) => {
    const acct = accounts.find(a => a.id === acctId);
    const amt  = parseFloat(borrowed) || parseFloat(original) || parseFloat(current) || 0;
    if (!acct || !amt) return '';
    const v = acct.currency === currency ? amt : convert(amt, currency, acct.currency);
    return v === null ? '' : String(Math.round(v * 100) / 100);
  };
  const recvAccount = accounts.find(a => a.id === recvAcct);
  // Overall interest rate worked out from borrowed vs total to repay (used if no rate is typed)
  const autoRate = parseFloat(principal) > 0 && parseFloat(original) > parseFloat(principal)
    ? Math.round(((parseFloat(original) - parseFloat(principal)) / parseFloat(principal)) * 1000) / 10
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const owed = parseFloat(current) || parseFloat(original);   // a new loan defaults to the total to repay
    if (!name.trim() || !owed) return;
    const amount  = parseFloat(recvAmt);
    const receipt = recvAccount && amount > 0
      ? { accountId: recvAcct, amount, date: recvDate, fx: txFxMeta(recvAccount.currency) }
      : null;
    setBusy(true);
    await onSave({
      name:           name.trim(),
      currency,
      originalAmount: parseFloat(original) || parseFloat(current),
      principal:      parseFloat(principal) || null,
      currentBalance: owed,
      interestRate:   parseFloat(rate) || autoRate || null,
      interestAuto:   !parseFloat(rate) && !!autoRate,
      monthlyPayment: parseFloat(payment) || null,
      dueDate:        dueDate || null,
      notes:          notes.trim() || null,
    }, receipt);
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
              <label>Amount Borrowed ({symbolFor(currency)})</label>
              <input type="number" min="0" step="0.01" placeholder="Cash you received"
                value={principal} onChange={e => {
                  setPrincipal(e.target.value);
                  if (!recvTouched && recvAcct) setRecvAmt(suggestRecv(recvAcct, e.target.value));
                }} />
            </div>
            <div className="form-group">
              <label>Total to Repay, incl. Interest ({symbolFor(currency)})</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={original} onChange={e => setOriginal(e.target.value)} />
            </div>
          </div>
          {parseFloat(principal) > 0 && parseFloat(original) > parseFloat(principal) && (
            <p className="fx-hint">
              Interest: {fmtCur(parseFloat(original) - parseFloat(principal), currency)}
              {' '}({(((parseFloat(original) - parseFloat(principal)) / parseFloat(principal)) * 100).toFixed(1)}% of the amount borrowed)
            </p>
          )}
          <div className="form-group">
            <label>Amount Still Owed ({symbolFor(currency)})</label>
            <input type="number" min="0" step="0.01" placeholder={original ? `${original} (same as total to repay)` : '0.00'}
              value={current} onChange={e => setCurrent(e.target.value)} required={!original} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Interest Rate % (optional)</label>
              <input type="number" min="0" step="0.1" placeholder={autoRate ? `${autoRate} (auto)` : 'e.g. 18.5'}
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

          {receivedTx ? (
            <p className="fx-hint">
              ✓ Cash received: {fmtCur(receivedTx.amount, receivedTx.currency)} into{' '}
              {accounts.find(a => a.id === receivedTx.accountId)?.name || 'an account'} on {receivedTx.date}.
            </p>
          ) : accounts.length > 0 && (
            <div className="loan-receipt">
              <div className="form-group">
                <label>Money received into (optional)</label>
                <select value={recvAcct} onChange={e => {
                  setRecvAcct(e.target.value);
                  if (!recvTouched) setRecvAmt(suggestRecv(e.target.value));
                }}>
                  <option value="">— Not recorded —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                </select>
                <p className="fx-hint">Adds the loan money to that account. It is not counted as income.</p>
              </div>
              {recvAccount && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Amount received ({symbolFor(recvAccount.currency)})</label>
                    <input type="number" min="0.01" step="0.01" value={recvAmt}
                      onChange={e => { setRecvAmt(e.target.value); setRecvTouched(true); }} required />
                  </div>
                  <div className="form-group">
                    <label>Date received</label>
                    <input type="date" value={recvDate} onChange={e => setRecvDate(e.target.value)} required />
                  </div>
                </div>
              )}
            </div>
          )}
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
  const [units,      setUnits]      = useState(existing?.units || '');
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
        ...(assetUsesUnits(assetType) && parseFloat(units) > 0 ? { units: parseFloat(units) } : {}),
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
          {assetUsesUnits(assetType) && (
            <div className="form-group">
              <label>Number of shares / units (optional)</label>
              <input type="number" min="0" step="any" placeholder="e.g. 25" value={units} onChange={e => setUnits(e.target.value)} />
              {parseFloat(units) > 0 && parseFloat(costBasis) > 0 && (
                <p className="fx-hint">{fmtCur(parseFloat(costBasis) / parseFloat(units), currency)} per share</p>
              )}
            </div>
          )}
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
  const units = Number(asset.units) || 0;

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
          {units > 0 && (
            <div className="form-group">
              <label>Or price per share ({symbolFor(asset.currency)}) × {fmtUnits(units)} shares</label>
              <input type="number" min="0" step="any" placeholder="Price today"
                onChange={e => { const p = parseFloat(e.target.value); if (p >= 0) setValue(String(Math.round(p * units * 100) / 100)); }} />
            </div>
          )}
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

// ─── Withdraw Modal ────────────────────────────────────────────────────────

function WithdrawModal({ asset, accounts, onWithdraw, onClose }) {
  const { fmtCur, convert, txFxMeta } = usePreferences();
  const fmt   = (v) => fmtCur(v, asset.currency);
  const held  = Number(asset.units) || 0;
  const value = Number(asset.currentValue) || 0;
  const [close,    setClose]    = useState(false);
  const [units,    setUnits]    = useState('');
  const [amount,   setAmount]   = useState('');
  const [toAcct,   setToAcct]   = useState(accounts[0]?.id || '');
  const [received, setReceived] = useState('');
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [busy,     setBusy]     = useState(false);

  const target   = accounts.find(a => a.id === toAcct);
  const crossCur = target && target.currency !== asset.currency;
  const u     = close ? held : (parseFloat(units) || 0);
  const amt   = parseFloat(amount) || 0;
  const share = close ? 1 : held > 0 && u > 0 ? u / held : value > 0 ? amt / value : 0;
  const cost  = (asset.costBasis || 0) * Math.min(share, 1);
  const gain  = amt - cost;
  const tooMuch = !close && (amt > value + 0.005 || (held > 0 && u > held + 0.000001));
  const suggestReceived = (v, acctId = toAcct) => {
    const acct = accounts.find(a => a.id === acctId);
    if (!acct || !(v > 0)) return '';
    const c = acct.currency === asset.currency ? v : convert(v, asset.currency, acct.currency);
    return c === null ? '' : String(Math.round(c * 100) / 100);
  };
  const setAmountAndReceived = (v) => { setAmount(v); setReceived(suggestReceived(parseFloat(v))); };

  const toggleClose = (on) => {
    setClose(on);
    if (on) { setUnits(''); setAmountAndReceived(String(value)); }
  };
  const changeUnits = (v) => {
    setUnits(v);
    const n = parseFloat(v);
    if (held > 0 && n > 0) setAmountAndReceived(String(Math.round((value * n / held) * 100) / 100));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!(amt > 0) || !toAcct || tooMuch) return;
    const got = crossCur ? parseFloat(received) : amt;
    if (!(got > 0)) return;
    setBusy(true);
    await onWithdraw(asset, { value: amt, units: u, close, accountId: toAcct, received: got, date, fx: txFxMeta(target.currency) });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Withdraw from {asset.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <p className="fx-hint">
            Worth {fmt(value)} now{held > 0 ? ` (${fmtUnits(held)} shares)` : ''}, with {fmt(asset.costBasis || 0)} of your own money in it.
          </p>
          <label className="held-check">
            <input type="checkbox" checked={close} onChange={e => toggleClose(e.target.checked)} />
            Withdraw everything and close this investment
          </label>
          {held > 0 && !close && (
            <div className="form-group">
              <label>Shares sold (optional)</label>
              <input type="number" min="0" step="any" max={held} placeholder={`Up to ${fmtUnits(held)}`} value={units} onChange={e => changeUnits(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label>{close ? 'Total value withdrawn' : 'Value withdrawn'} ({symbolFor(asset.currency)})</label>
            <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmountAndReceived(e.target.value)} autoFocus={!held} required />
          </div>
          {tooMuch && (
            <p className="fx-hint" style={{ color: 'var(--danger)' }}>
              That's more than this investment holds. Update its value first, or tick "Withdraw everything" if you're closing it.
            </p>
          )}
          <div className="form-group">
            <label>Paid into account</label>
            <select value={toAcct} onChange={e => { setToAcct(e.target.value); setReceived(suggestReceived(amt, e.target.value)); }} required>
              <option value="">— Select account —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
            </select>
          </div>
          {crossCur && (
            <div className="form-group">
              <label>Amount that arrived in {target.name} ({symbolFor(target.currency)})</label>
              <input type="number" min="0.01" step="0.01" value={received} onChange={e => setReceived(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          {amt > 0 && !tooMuch && (
            <p className="fx-hint">
              {fmt(Math.min(cost, amt))} of this is your own money coming back
              {gain > 0.005 ? <>, and <b>{fmt(gain)}</b> is gain, recorded as income.</> : gain < -0.005 ? <>. It's <b>{fmt(-gain)}</b> less than you put in.</> : '.'}
              {!close && share < 0.9999 && <> {fmt(value - amt)}{held > 0 ? ` (${fmtUnits(held - u)} shares)` : ''} stays invested.</>}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy || tooMuch}>{close ? 'Close investment' : 'Withdraw'}</button>
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
      return { ...t, signed: ['income', 'loan', 'lendrepay', 'assetout'].includes(t.type) ? t.amount : -t.amount, detail: t.category };
    })
    .sort(sort === 'newest' ? newestFirst : oldestFirst);

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
          {account.heldForOthers && <span className="held-badge">Held for others · not in net worth</span>}
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

// Paid-off debt in the history list
function PaidDebtCard({ debt, transactions, onDelete }) {
  const { fmtCur } = usePreferences();
  const fmt = (v) => fmtCur(v, debt.currency);
  const h = repaymentHistory(debt, transactions);
  const when = debt.paidOffDate
    ? new Date(debt.paidOffDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <div className="debt-card paid-debt">
      <div className="debt-card-header">
        <div>
          <p className="debt-name">✓ {debt.name}</p>
          <p className="debt-meta">
            Paid off{when ? ` on ${when}` : ''}
            {debt.settlementDiscount > 0 ? ` · settled early, saved ${fmt(debt.settlementDiscount)}` : ''}
            {h.months !== null && h.count > 1 ? ` · took ${h.months === 0 ? 'under a month' : `${h.months} month${h.months === 1 ? '' : 's'}`}` : ''}
          </p>
        </div>
        <div className="acct-actions">
          <button className="icon-btn delete-btn" onClick={() => onDelete(debt.id)} title="Delete from history"><Trash2 size={13} strokeWidth={1.6} /></button>
        </div>
      </div>
      <div className="bg-figures">
        <div><span className="bs-label">Borrowed</span><span className="bg-val">{fmt(debt.principal || debt.originalAmount || 0)}</span></div>
        <div><span className="bs-label">Repaid</span><span className="bg-val">{h.count ? fmt(h.totalRepaid) : '—'}</span></div>
        <div><span className="bs-label">Repayments</span><span className="bg-val">{h.count || '—'}</span></div>
      </div>
    </div>
  );
}

function DebtCard({ debt, onEdit, onDelete, onSettle }) {
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
          {debt.principal > 0 && debt.originalAmount > debt.principal && (
            <p className="debt-meta">Borrowed {fmt(debt.principal)} · Interest {fmt(debt.originalAmount - debt.principal)}</p>
          )}
          {debt.interestRate && <p className="debt-meta">{debt.interestRate}% interest{debt.interestAuto ? ' (overall)' : ''}{debt.dueDate ? ` · Due ${debt.dueDate}` : ''}</p>}
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
      {onSettle && (
        <div className="asset-card-actions">
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--success)' }} onClick={() => onSettle(debt)}>Mark as paid off</button>
        </div>
      )}
    </div>
  );
}

// ─── Asset Card ────────────────────────────────────────────────────────────

function AssetCard({ asset, transactions, onUpdateValue, onWithdraw, onDelete, onToggleHeld }) {
  const { fmtCur, assetTypes } = usePreferences();
  const [showHistory, setShowHistory] = useState(false);
  const fmt = (v) => fmtCur(v, asset.currency);
  const Icon = ASSET_TYPE_ICONS[asset.assetType] || ASSET_TYPE_ICONS.other;
  const meta = getAssetTypeMeta(assetTypes, asset.assetType);
  const gain = asset.currentValue - asset.costBasis;
  const gainPct = asset.costBasis > 0 ? ((gain / asset.costBasis) * 100).toFixed(1) : 0;
  const units = Number(asset.units) || 0;
  const history = assetHistory(asset, transactions);
  const withdrawn = history.filter(r => r.gain !== undefined);
  const realised  = withdrawn.reduce((s, r) => s + r.gain, 0);

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
            {asset.heldForOthers && <span className="held-badge">Held for others · not in net worth</span>}
          </div>
        </div>
        <button className="icon-btn delete-btn" onClick={() => onDelete(asset.id)} title="Delete"><Trash2 size={13} strokeWidth={1.6} /></button>
      </div>

      <label className="held-check small">
        <input type="checkbox" checked={!!asset.heldForOthers} onChange={e => onToggleHeld(asset, e.target.checked)} />
        Money held for others (not mine)
      </label>

      <div className="asset-values">
        {units > 0 && (
          <div className="asset-val-row">
            <span className="asset-val-label">Shares</span>
            <span className="asset-val">{fmtUnits(units)} · avg {fmt(asset.costBasis / units)}</span>
          </div>
        )}
        <div className="asset-val-row">
          <span className="asset-val-label">Invested</span>
          <span className="asset-val">{fmt(asset.costBasis)}</span>
        </div>
        <div className="asset-val-row">
          <span className="asset-val-label">Current Value</span>
          <span className="asset-val" style={{ color: 'var(--text-1)', fontWeight: 700, textAlign: 'right' }}>
            {fmt(asset.currentValue)}
            {units > 0 && <span className="fx-approx">{fmt(asset.currentValue / units)} per share</span>}
            <BaseApprox amount={asset.currentValue} currency={asset.currency} />
          </span>
        </div>
        <div className="asset-val-row">
          <span className="asset-val-label">Gain / Loss</span>
          <span className="asset-val" style={{ color: gain >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct}%)
          </span>
        </div>
        {withdrawn.length > 0 && (
          <div className="asset-val-row">
            <span className="asset-val-label">Withdrawn so far</span>
            <span className="asset-val">
              {fmt(withdrawn.reduce((s, r) => s + r.amount, 0))}
              {Math.abs(realised) > 0.005 && <span className="fx-approx">{realised > 0 ? `incl. ${fmt(realised)} gain` : `${fmt(-realised)} below cost`}</span>}
            </span>
          </div>
        )}
      </div>

      <div className="asset-card-actions">
        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => onUpdateValue(asset)}>
          Update Value
        </button>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--success)' }} onClick={() => onWithdraw(asset)}>
          Withdraw
        </button>
        {history.length > 0 && (
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} aria-expanded={showHistory} onClick={() => setShowHistory(v => !v)}>
            {showHistory ? 'Hide history' : 'History'}
          </button>
        )}
      </div>
      {showHistory && <AssetHistoryTable asset={asset} rows={history} />}
    </div>
  );
}

// A fully withdrawn investment, kept in the Closed list with what went in and what came out.
// Older cash-outs (before withdrawals existed) only have their recorded payout.
function ClosedAssetCard({ asset, transactions, onDelete }) {
  const { fmtCur, assetTypes } = usePreferences();
  const [showHistory, setShowHistory] = useState(false);
  const fmt  = (v) => fmtCur(v, asset.currency);
  const meta = getAssetTypeMeta(assetTypes, asset.assetType);
  const history = assetHistory(asset, transactions);
  const outs = history.filter(r => r.gain !== undefined);
  const putIn = outs.length ? outs.reduce((s, r) => s - r.cost, 0) : asset.costBasis || 0;
  const tookOut = outs.length ? outs.reduce((s, r) => s + r.amount, 0) : asset.cashedOutAmount;
  const result = tookOut != null ? tookOut - putIn : null;
  return (
    <div className="asset-card paid-debt">
      <div className="asset-card-header">
        <div>
          <p className="acct-name">✓ {asset.name}</p>
          <p className="acct-type">{meta.label}{asset.cashedOutDate ? ` · Closed ${fmtShortDate(asset.cashedOutDate)}` : ''}</p>
        </div>
        <button className="icon-btn delete-btn" onClick={() => onDelete(asset.id)} title="Delete from history"><Trash2 size={13} strokeWidth={1.6} /></button>
      </div>
      <div className="bg-figures">
        <div><span className="bs-label">Put in</span><span className="bg-val">{fmt(putIn)}</span></div>
        <div><span className="bs-label">Took out</span><span className="bg-val">{tookOut != null ? fmt(tookOut) : '—'}</span></div>
        <div>
          <span className="bs-label">Gain / loss</span>
          <span className={`bg-val ${result >= 0 ? 'good' : 'bad'}`}>{result != null ? `${result >= 0 ? '+' : '−'}${fmt(Math.abs(result))}` : '—'}</span>
        </div>
      </div>
      {history.length > 0 && (
        <div className="asset-card-actions">
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} aria-expanded={showHistory} onClick={() => setShowHistory(v => !v)}>
            {showHistory ? 'Hide history' : 'History'}
          </button>
        </div>
      )}
      {showHistory && <AssetHistoryTable asset={asset} rows={history} />}
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

function GroupTile({ id, title, count, noun, countLabel, open, onToggle, onAdd, addTitle, children }) {
  return (
    <div className={`group-card ${open ? 'active' : ''}`} role="button" tabIndex={0}
      aria-expanded={open}
      onClick={() => onToggle(id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(id); } }}>
      <div className="bg-head">
        <span className="bg-title">{title}</span>
        <span className="bg-head-right">
          <span className="bg-count">
            {countLabel || `${count} ${count === 1 ? noun : `${noun}s`}`}
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

export default function Accounts({ accounts, debts, assets, transactions = [], lends = [], addLend, lendMore, updateLend, recordLendRepayment, writeOffLend, deleteLend, projects = [], addProject, updateProject, deleteProject, recordLoanReceipt, missingRates = [], addAccount, updateAccount, deleteAccount, addDebt, updateDebt, deleteDebt, addAsset, updateAsset, updateAssetValue, withdrawFromAsset, deleteAsset, addTransfer }) {
  const { fmt, fmtCur, baseCurrency, toBase } = usePreferences();
  const [modal, setModal] = useState(null); // { type, data? }
  const close = () => setModal(null);
  const [confirm, confirmDialog] = useConfirm();
  const ask = (title, message) => confirm({ title, message });
  const confirmDeleteAccount = async (id) => {
    const a = accounts.find(x => x.id === id); if (!a) return;
    const n = transactions.filter(t => t.accountId === id || t.toAccountId === id).length;
    if (await ask(`Delete ${a.name}?`,
      `Its balance (${fmtCur(a.balance, a.currency)}) will no longer count towards your totals.` +
      (n ? ` Its ${n} transaction${n === 1 ? '' : 's'} stay in your history.` : '') + ' This can\'t be undone.')) deleteAccount(id);
  };
  const confirmDeleteDebt = async (id) => {
    const d = debts.find(x => x.id === id); if (!d) return;
    if (await ask(`Delete ${d.name}?`, 'The debt record is removed. Repayments already recorded stay in your transactions. This can\'t be undone.')) deleteDebt(id);
  };
  // Settle a debt early: the lender accepted less than the balance, so the rest is written off
  const confirmSettleDebt = async (d) => {
    const left = Number(d.currentBalance) || 0;
    if (await confirm({ title: `Mark ${d.name} as paid off?`, confirmLabel: 'Mark paid off', danger: false,
      message: `The remaining ${fmtCur(left, d.currency)} is cleared as an early-settlement discount. No money moves between your accounts.` }))
      updateDebt(d.id, { currentBalance: 0, settlementDiscount: Math.round(left * 100) / 100 });
  };
  const confirmDeleteAsset = async (id) => {
    const a = assets.find(x => x.id === id); if (!a) return;
    if (await ask(`Delete ${a.name}?`, `Its value (${fmtCur(a.currentValue, a.currency)}) will no longer count towards your net worth. Transactions already recorded stay in your history. This can't be undone.`)) deleteAsset(id);
  };

  // ── Totals per group, in the base currency ────────────────────────────
  const activeAssets = assets.filter(a => a.status === 'active');
  const closedAssets = assets.filter(a => a.status !== 'active')
    .sort((a, b) => (b.cashedOutDate || '').localeCompare(a.cashedOutDate || ''));
  const [showClosedAssets, setShowClosedAssets] = useState(false);
  const openDebts    = debts.filter(d => !isPaidOff(d));
  const paidDebts    = debts.filter(isPaidOff)
    .sort((a, b) => (b.paidOffDate || '').localeCompare(a.paidOffDate || ''));
  const [showPaidDebts, setShowPaidDebts] = useState(false);
  const base = (amount, cur) => toBase(amount || 0, cur) ?? 0;

  // Money held for others (e.g. tithe set aside for church) is tracked but isn't yours:
  // it's left out of cash, investments and net worth and shown on its own line
  const ownAccounts  = accounts.filter(a => !a.heldForOthers);
  const ownAssets    = activeAssets.filter(a => !a.heldForOthers);
  const heldTotal    = accounts.filter(a => a.heldForOthers).reduce((s, a) => s + (a.baseBalance || 0), 0)
                     + activeAssets.filter(a => a.heldForOthers).reduce((s, a) => s + (a.baseValue || 0), 0);
  const totalCash        = ownAccounts.reduce((s, a) => s + (a.baseBalance || 0), 0);
  const totalDebts       = openDebts.reduce((s, d) => s + (d.baseBalance || 0), 0);
  const totalBorrowed    = openDebts.reduce((s, d) => s + base(d.originalAmount || d.currentBalance, d.currency), 0);
  const monthlyPayments  = openDebts.reduce((s, d) => s + base(d.monthlyPayment, d.currency), 0);
  const paidPct          = totalBorrowed > 0 ? Math.max(0, Math.min(100, (1 - totalDebts / totalBorrowed) * 100)) : 0;
  const totalInvested    = ownAssets.reduce((s, a) => s + base(a.costBasis, a.currency), 0);
  const totalInvestments = ownAssets.reduce((s, a) => s + (a.baseValue || 0), 0);
  const investGain       = totalInvestments - totalInvested;
  // Money lent: unpaid principal is still yours
  const openLends    = lends.filter(l => (l.status || 'active') === 'active');
  const closedLends  = lends.filter(l => (l.status || 'active') !== 'active')
    .sort((a, b) => (b.closedDate || '').localeCompare(a.closedDate || ''));
  const totalLent    = openLends.reduce((s, l) => s + (l.baseOwed || 0), 0);
  const owedToMe     = openLends.reduce((s, l) => s + (toBase(lendOutstanding(l), l.currency) ?? 0), 0);
  const overdueCount = openLends.filter(l => isLendOverdue(l)).length;
  const [showClosedLends, setShowClosedLends] = useState(false);
  const netWorth         = totalCash + totalInvestments + totalLent - totalDebts;

  // Cash held per currency, base currency first (shown on the Cash tile)
  const cashByCurrency = Object.entries(
    ownAccounts.reduce((m, a) => ({ ...m, [a.currency]: (m[a.currency] || 0) + (a.balance || 0) }), {})
  ).sort(([a], [b]) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : a.localeCompare(b)));

  // Projects: totals across all projects (base currency, each transaction at its rate of the day)
  const activeProjects = projects.filter(p => p.status !== 'closed');
  const projTotals = projects.reduce((t, p) => {
    const st = projectStats(p, transactions);
    return { putIn: t.putIn + st.putInBase, earned: t.earned + st.earnedBase, net: t.net + st.netBase };
  }, { putIn: 0, earned: 0, net: 0 });

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
          <span className="nw-sub">Cash + investments + money lent − debts, in {baseCurrency}</span>
          {heldTotal > 0 && (
            <span className="nw-held">Held for others: {fmt(heldTotal)} <small>(not included)</small></span>
          )}
        </div>
      </div>

      {missingRates.length > 0 && (
        <p className="fx-warning">
          No exchange rate available for {missingRates.join(', ')}. Those amounts are left out of the totals.
          Set a rate in Settings → Exchange Rates.
        </p>
      )}

      <div className="group-grid cols-4">
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
                    onDelete={confirmDeleteAccount}
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
          countLabel={paidDebts.length ? `${openDebts.length} active · ${paidDebts.length} paid off` : null}
          onAdd={() => setModal({ type: 'debt' })} addTitle="Add debt">
          {openDebts.length === 0 ? (
            <span className="bg-empty">{paidDebts.length ? 'All paid off 🎉' : 'No debts recorded'}</span>
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
            {openDebts.length === 0 ? (
              <p className="accounts-empty">
                {paidDebts.length ? 'No active debts. Everything is paid off. 🎉' : 'No debts recorded. Add a loan or informal debt to track it.'}
              </p>
            ) : (
              <div className="acct-list">
                {openDebts.map(d => (
                  <DebtCard
                    key={d.id}
                    debt={d}
                    onEdit={debt => setModal({ type: 'debt', data: debt })}
                    onDelete={confirmDeleteDebt}
                    onSettle={confirmSettleDebt}
                  />
                ))}
              </div>
            )}
            {paidDebts.length > 0 && (
              <>
                <button type="button" className={`history-toggle ${showPaidDebts ? 'open' : ''}`}
                  aria-expanded={showPaidDebts} onClick={() => setShowPaidDebts(v => !v)}>
                  <span>Paid off ({paidDebts.length})</span>
                  <ChevronRight size={15} strokeWidth={1.8} className="bg-chevron" />
                </button>
                {showPaidDebts && (
                  <div className="acct-list">
                    {paidDebts.map(d => (
                      <PaidDebtCard key={d.id} debt={d} transactions={transactions} onDelete={confirmDeleteDebt} />
                    ))}
                  </div>
                )}
              </>
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
              <p className="accounts-empty">{closedAssets.length ? 'No open investments.' : 'No assets tracked yet. Add a treasury bill, property, or any investment.'}</p>
            ) : (
              <div className="asset-grid">
                {activeAssets.map(a => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    transactions={transactions}
                    onUpdateValue={asset => setModal({ type: 'updateValue', data: asset })}
                    onWithdraw={asset => setModal({ type: 'withdraw', data: asset })}
                    onDelete={confirmDeleteAsset}
                    onToggleHeld={(asset, v) => updateAsset(asset.id, { heldForOthers: v })}
                  />
                ))}
              </div>
            )}
            {closedAssets.length > 0 && (
              <>
                <button type="button" className={`history-toggle ${showClosedAssets ? 'open' : ''}`}
                  aria-expanded={showClosedAssets} onClick={() => setShowClosedAssets(v => !v)}>
                  <span>Closed ({closedAssets.length})</span>
                  <ChevronRight size={15} strokeWidth={1.8} className="bg-chevron" />
                </button>
                {showClosedAssets && (
                  <div className="asset-grid">
                    {closedAssets.map(a => <ClosedAssetCard key={a.id} asset={a} transactions={transactions} onDelete={confirmDeleteAsset} />)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {/* ── Projects (businesses / side projects) ── */}
        <GroupTile id="projects" open={openGroup === 'projects'} onToggle={toggle} title="Projects"
          count={activeProjects.length} noun="project"
          onAdd={() => setModal({ type: 'projectForm' })} addTitle="New project">
          {projects.length === 0 ? (
            <span className="bg-empty">Track a business or side project</span>
          ) : (
            <div className="bg-figures">
              <div><span className="bs-label">Put in</span><span className="bg-val">{fmt(projTotals.putIn)}</span></div>
              <div><span className="bs-label">Earned</span><span className="bg-val">{fmt(projTotals.earned)}</span></div>
              <div><span className="bs-label">Net</span><span className={`bg-val ${projTotals.net >= 0 ? 'good' : 'bad'}`}>{projTotals.net >= 0 ? '+' : '−'}{fmt(Math.abs(projTotals.net))}</span></div>
            </div>
          )}
        </GroupTile>
        {openGroup === 'projects' && (
          <div className="group-panel">
            {projects.length === 0 ? (
              <p className="accounts-empty">
                No projects yet. Create one to track the money you put into a business and what it earns.
                {' '}<button type="button" className="auth-switch-link" onClick={() => setModal({ type: 'projectForm' })}>New project</button>
              </p>
            ) : (
              <div className="asset-grid">
                {[...activeProjects, ...projects.filter(p => p.status === 'closed')].map(p => (
                  <ProjectCard key={p.id} project={p} transactions={transactions}
                    onOpen={proj => setModal({ type: 'project', data: proj })} />
                ))}
              </div>
            )}
          </div>
        )}
        {/* ── Money lent to others ── */}
        <GroupTile id="lent" open={openGroup === 'lent'} onToggle={toggle} title="Money lent"
          count={openLends.length} noun="loan"
          countLabel={openLends.length || closedLends.length ? `${openLends.length} open${closedLends.length ? ` · ${closedLends.length} closed` : ''}` : null}
          onAdd={() => setModal({ type: 'lendForm' })} addTitle="Lend money">
          {openLends.length === 0 ? (
            <span className="bg-empty">{closedLends.length ? 'Nothing owed to you right now' : 'Track money you lend to others'}</span>
          ) : (
            <div className="bg-figures">
              <div><span className="bs-label">Owed to you</span><span className="bg-val good">{fmt(owedToMe)}</span></div>
              <div><span className="bs-label">People</span><span className="bg-val">{new Set(openLends.map(l => l.name.trim().toLowerCase())).size}</span></div>
              <div><span className="bs-label">Overdue</span><span className={`bg-val ${overdueCount ? 'bad' : ''}`}>{overdueCount || '—'}</span></div>
            </div>
          )}
        </GroupTile>
        {openGroup === 'lent' && (
          <div className="group-panel">
            {openLends.length === 0 ? (
              <p className="accounts-empty">
                {closedLends.length ? 'No open loans.' : 'You haven\'t lent money to anyone.'}
                {' '}<button type="button" className="auth-switch-link" onClick={() => setModal({ type: 'lendForm' })}>Lend money</button>
              </p>
            ) : (
              <div className="acct-list">
                {[...openLends].sort((a, b) => (isLendOverdue(b) - isLendOverdue(a)) || (a.dueDate || '9').localeCompare(b.dueDate || '9')).map(l => (
                  <LendCard key={l.id} lend={l}
                    onRepay={lend => setModal({ type: 'lendRepay', data: lend })}
                    onMore={lend => setModal({ type: 'lendMore', data: lend })}
                    payouts={transactions.filter(t => t.lendId === l.id && t.type === 'lend').length}
                    onEdit={lend => setModal({ type: 'lendForm', data: lend })}
                    onWriteOff={writeOffLend}
                    onDelete={lend => deleteLend(lend.id)} />
                ))}
              </div>
            )}
            {closedLends.length > 0 && (
              <>
                <button type="button" className={`history-toggle ${showClosedLends ? 'open' : ''}`}
                  aria-expanded={showClosedLends} onClick={() => setShowClosedLends(v => !v)}>
                  <span>Repaid &amp; written off ({closedLends.length})</span>
                  <ChevronRight size={15} strokeWidth={1.8} className="bg-chevron" />
                </button>
                {showClosedLends && (
                  <div className="acct-list">
                    {closedLends.map(l => (
                      <LendCard key={l.id} lend={l} onRepay={() => {}} onEdit={() => {}} onWriteOff={() => {}}
                        onDelete={lend => deleteLend(lend.id)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal?.type === 'lendForm' && (
        <LendFormModal existing={modal.data} accounts={accounts}
          onSave={modal.data ? (u) => updateLend(modal.data.id, u) : addLend}
          onClose={close} />
      )}
      {modal?.type === 'lendMore' && (
        <LendMoreModal lend={lends.find(l => l.id === modal.data.id) || modal.data} accounts={accounts}
          onSave={lendMore} onClose={close} />
      )}
      {modal?.type === 'lendRepay' && (
        <LendRepayModal lend={lends.find(l => l.id === modal.data.id) || modal.data} accounts={accounts}
          onSave={recordLendRepayment} onClose={close} />
      )}
      {modal?.type === 'account' && (
        <AccountModal
          existing={modal.data}
          onSave={modal.data
            ? (updates) => updateAccount(modal.data.id, updates)
            : addAccount}
          onClose={close}
        />
      )}
      {modal?.type === 'projectForm' && (
        <ProjectFormModal existing={modal.data}
          onSave={modal.data ? (u) => updateProject(modal.data.id, u) : addProject}
          onClose={close} />
      )}
      {modal?.type === 'project' && (
        <ProjectDetailModal
          project={projects.find(p => p.id === modal.data.id) || modal.data}
          transactions={transactions} accounts={accounts}
          onEdit={p => setModal({ type: 'projectForm', data: p })}
          onToggleStatus={p => updateProject(p.id, { status: p.status === 'closed' ? 'active' : 'closed' })}
          onDelete={deleteProject}
          onClose={close} />
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
          existing={modal.data} accounts={accounts} transactions={transactions}
          onSave={modal.data
            ? async (updates, receipt) => {
                await updateDebt(modal.data.id, updates);
                if (receipt) await recordLoanReceipt({ ...modal.data, ...updates }, receipt);
              }
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
      {modal?.type === 'withdraw' && (
        <WithdrawModal asset={assets.find(a => a.id === modal.data.id) || modal.data} accounts={accounts} onWithdraw={withdrawFromAsset} onClose={close} />
      )}
      {confirmDialog}
    </div>
  );
}
