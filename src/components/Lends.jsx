import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { usePreferences, symbolFor } from '../contexts/PreferencesContext';
import CurrencySelect from './CurrencySelect';
import { lendExpected, lendOutstanding, isLendOverdue, splitRepayment } from '../lends';

const today   = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const round2  = (v) => Math.round(v * 100) / 100;

// ─── Lend money / edit a loan ─────────────────────────────────────────────

export function LendFormModal({ existing, accounts, onSave, onClose }) {
  const { baseCurrency, convert, fmtCur, txFxMeta } = usePreferences();
  const isEdit = !!existing;
  const [name,      setName]      = useState(existing?.name || '');
  const [currency,  setCurrency]  = useState(existing?.currency || baseCurrency);
  const [principal, setPrincipal] = useState(existing?.principal ?? '');
  const [expected,  setExpected]  = useState(existing?.expected ?? '');
  const [date,      setDate]      = useState(existing?.startDate || today());
  const [dueDate,   setDueDate]   = useState(existing?.dueDate || '');
  const [notes,     setNotes]     = useState(existing?.notes || '');
  const [fromAcct,  setFromAcct]  = useState('');
  const [sent,      setSent]      = useState('');
  const [sentTouched, setSentTouched] = useState(false);
  const [busy,      setBusy]      = useState(false);

  const account = accounts.find(a => a.id === fromAcct);
  const suggestSent = (acctId, amt = principal, cur = currency) => {
    const a = accounts.find(x => x.id === acctId);
    const v = parseFloat(amt);
    if (!a || !(v > 0)) return '';
    const out = a.currency === cur ? v : convert(v, cur, a.currency);
    return out === null ? '' : String(round2(out));
  };
  const interest = parseFloat(expected) > parseFloat(principal) ? parseFloat(expected) - parseFloat(principal) : 0;

  const submit = async (e) => {
    e.preventDefault();
    const p = parseFloat(principal);
    if (!name.trim() || !(p > 0)) return;
    if (!isEdit && !account) return;
    setBusy(true);
    const data = {
      name: name.trim(), currency, principal: p,
      expected: parseFloat(expected) > p ? parseFloat(expected) : null,
      startDate: date, dueDate: dueDate || null, notes: notes.trim() || null,
    };
    if (isEdit) await onSave(data);
    else await onSave(data, { accountId: fromAcct, amount: parseFloat(sent) || p, date, fx: txFxMeta(account.currency) });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Loan' : 'Lend Money'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          {!isEdit && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
              The money leaves your account but stays part of your net worth, because you're owed it.
              It isn't counted as spending.
            </p>
          )}
          <div className="form-group">
            <label>Lent to</label>
            <input type="text" placeholder="e.g. Kwame" value={name} onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>Currency</label>
            <CurrencySelect value={currency} onChange={c => { setCurrency(c); if (!sentTouched) setSent(suggestSent(fromAcct, principal, c)); }} disabled={isEdit} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Amount lent ({symbolFor(currency)})</label>
              <input type="number" min="0.01" step="0.01" value={principal} disabled={isEdit}
                onChange={e => { setPrincipal(e.target.value); if (!sentTouched) setSent(suggestSent(fromAcct, e.target.value)); }} required />
            </div>
            <div className="form-group">
              <label>To get back, incl. interest ({symbolFor(currency)}, optional)</label>
              <input type="number" min="0" step="0.01" placeholder="Same as lent" value={expected} onChange={e => setExpected(e.target.value)} />
            </div>
          </div>
          {interest > 0 && (
            <p className="fx-hint">Interest you'll receive: {fmtCur(interest, currency)}. It's counted as income when it's paid.</p>
          )}
          {!isEdit && (
            <>
              <div className="form-group">
                <label>Paid from account</label>
                <select value={fromAcct} onChange={e => { setFromAcct(e.target.value); if (!sentTouched) setSent(suggestSent(e.target.value)); }} required>
                  <option value="">— Select account —</option>
                  {accounts.filter(a => !a.heldForOthers).map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                </select>
              </div>
              {account && account.currency !== currency && (
                <div className="form-group">
                  <label>Amount that left {account.name} ({symbolFor(account.currency)})</label>
                  <input type="number" min="0.01" step="0.01" value={sent}
                    onChange={e => { setSent(e.target.value); setSentTouched(true); }} required />
                </div>
              )}
            </>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Date lent</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isEdit} required />
            </div>
            <div className="form-group">
              <label>Due date (optional)</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <input type="text" placeholder="e.g. For school fees" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{isEdit ? 'Save Changes' : 'Lend Money'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Record a repayment ───────────────────────────────────────────────────

export function LendRepayModal({ lend, accounts, onSave, onClose }) {
  const { convert, fmtCur, txFxMeta } = usePreferences();
  const owed = lendOutstanding(lend);
  const [amount,  setAmount]  = useState(String(round2(owed)));
  const [acctId,  setAcctId]  = useState('');
  const [got,     setGot]     = useState('');
  const [gotTouched, setGotTouched] = useState(false);
  const [date,    setDate]    = useState(today());
  const [busy,    setBusy]    = useState(false);

  const account = accounts.find(a => a.id === acctId);
  const crossCur = account && account.currency !== lend.currency;
  const suggest = (aid, amt = amount) => {
    const a = accounts.find(x => x.id === aid);
    const v = parseFloat(amt);
    if (!a || !(v > 0)) return '';
    const out = a.currency === lend.currency ? v : convert(v, lend.currency, a.currency);
    return out === null ? '' : String(round2(out));
  };
  const amt = parseFloat(amount) || 0;
  const { interestPart } = splitRepayment(lend, amt);

  const submit = async (e) => {
    e.preventDefault();
    if (!(amt > 0) || !account) return;
    setBusy(true);
    await onSave(lend, {
      accountId: acctId, amount: amt,
      accountAmount: crossCur ? (parseFloat(got) || 0) : amt,
      date, fx: txFxMeta(account.currency),
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Repayment from {lend.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <p className="fx-hint">Still owed: <b>{fmtCur(owed, lend.currency)}</b></p>
          <div className="form-group">
            <label>Amount repaid ({symbolFor(lend.currency)})</label>
            <input type="number" min="0.01" step="0.01" value={amount}
              onChange={e => { setAmount(e.target.value); if (!gotTouched) setGot(suggest(acctId, e.target.value)); }} required />
            {interestPart > 0 && <p className="fx-hint">Includes {fmtCur(interestPart, lend.currency)} interest, recorded as income.</p>}
          </div>
          <div className="form-group">
            <label>Received into</label>
            <select value={acctId} onChange={e => { setAcctId(e.target.value); if (!gotTouched) setGot(suggest(e.target.value)); }} required>
              <option value="">— Select account —</option>
              {accounts.filter(a => !a.heldForOthers).map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
            </select>
          </div>
          {crossCur && (
            <div className="form-group">
              <label>Amount that arrived ({symbolFor(account.currency)})</label>
              <input type="number" min="0.01" step="0.01" value={got}
                onChange={e => { setGot(e.target.value); setGotTouched(true); }} required />
            </div>
          )}
          <div className="form-group">
            <label>Date received</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>Record Repayment</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────

export function LendCard({ lend, onRepay, onEdit, onWriteOff, onDelete }) {
  const { fmtCur } = usePreferences();
  const [confirm, setConfirm] = useState(null);   // 'writeoff' | 'delete'
  const fmt = (v) => fmtCur(v, lend.currency);
  const expected = lendExpected(lend);
  const owed = lendOutstanding(lend);
  const pct = expected > 0 ? Math.min(100, ((lend.repaid || 0) / expected) * 100) : 0;
  const open = (lend.status || 'active') === 'active';
  const overdue = isLendOverdue(lend);

  return (
    <div className={`debt-card ${open ? '' : 'paid-debt'}`}>
      <div className="debt-card-header">
        <div>
          <p className="debt-name">{lend.status === 'repaid' ? '✓ ' : ''}{lend.name}</p>
          <p className="debt-meta">
            Lent {fmt(lend.principal)} on {fmtDate(lend.startDate)}
            {lend.expected > lend.principal ? ` · ${fmt(lend.expected - lend.principal)} interest` : ''}
          </p>
          {open && lend.dueDate && (
            <p className={`debt-meta ${overdue ? 'lend-overdue' : ''}`}>{overdue ? 'Overdue since' : 'Due'} {fmtDate(lend.dueDate)}</p>
          )}
          {!open && (
            <p className="debt-meta">{lend.status === 'repaid' ? 'Repaid' : 'Written off'} on {fmtDate(lend.closedDate)}</p>
          )}
          {lend.notes && <p className="debt-meta">{lend.notes}</p>}
        </div>
        <div className="acct-actions">
          {open && <button className="icon-btn" onClick={() => onEdit(lend)} title="Edit"><Pencil size={13} strokeWidth={1.6} /></button>}
          <button className="icon-btn delete-btn" onClick={() => setConfirm('delete')} title="Delete"><Trash2 size={13} strokeWidth={1.6} /></button>
        </div>
      </div>
      <div className="debt-progress-wrap">
        <div className="progress-bar-wrap" style={{ height: 6 }}>
          <div className="progress-bar-fill" style={{ width: `${pct}%`, background: 'var(--success)' }} />
        </div>
        <div className="debt-amounts">
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Repaid {fmt(lend.repaid || 0)} of {fmt(expected)}</span>
          {open && <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmt(owed)} still owed</span>}
          {lend.status === 'written_off' && owed > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(owed)} written off</span>}
        </div>
      </div>

      {confirm ? (
        <div className="lend-confirm">
          <span>
            {confirm === 'writeoff'
              ? `Write off ${fmt(owed)}? It will no longer count towards your net worth.`
              : 'Delete this record? Transactions already recorded stay in your accounts.'}
          </span>
          <div>
            <button type="button" className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button type="button" className="btn-ghost" style={{ color: 'var(--danger)' }}
              onClick={() => { setConfirm(null); (confirm === 'writeoff' ? onWriteOff : onDelete)(lend); }}>
              {confirm === 'writeoff' ? 'Write off' : 'Delete'}
            </button>
          </div>
        </div>
      ) : open && (
        <div className="asset-card-actions">
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--success)' }} onClick={() => onRepay(lend)}>Record repayment</button>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setConfirm('writeoff')}>Write off</button>
        </div>
      )}
    </div>
  );
}
