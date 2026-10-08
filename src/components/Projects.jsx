import { useState } from 'react';
import { Pencil, Trash2, Briefcase } from 'lucide-react';
import { usePreferences } from '../contexts/PreferencesContext';
import { projectStats, PROJECT_COLORS } from '../projects';
import CategoryIcon from './CategoryIcon';

const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Net position line: profit, or how far from breaking even
function NetLine({ s }) {
  const { fmt } = usePreferences();
  if (s.putIn === 0 && s.earned === 0) return <span className="proj-net">No transactions yet</span>;
  return s.net >= 0
    ? <span className="proj-net good">In profit by {fmt(s.net)}</span>
    : <span className="proj-net">{fmt(-s.net)} from breaking even</span>;
}

// ─── Card shown under the Projects tile ───────────────────────────────────

export function ProjectCard({ project, transactions, onOpen }) {
  const { fmt } = usePreferences();
  const s = projectStats(project, transactions);
  return (
    <div className="proj-card" role="button" tabIndex={0} onClick={() => onOpen(project)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(project); } }}>
      <div className="proj-head">
        <span className="proj-dot" style={{ background: project.color }} />
        <div className="proj-title">
          <p className="acct-name">{project.name}</p>
          <p className="acct-type">
            {project.status === 'closed' ? 'Closed' : 'Active'} · since {fmtDate(project.startDate)} · {s.txs.length} transaction{s.txs.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <div className="bg-figures">
        <div><span className="bs-label">Put in</span><span className="bg-val">{fmt(s.putIn)}</span></div>
        <div><span className="bs-label">Earned</span><span className="bg-val">{fmt(s.earned)}</span></div>
        <div><span className="bs-label">Net</span><span className={`bg-val ${s.net >= 0 ? 'good' : 'bad'}`}>{s.net >= 0 ? '+' : '−'}{fmt(Math.abs(s.net))}</span></div>
      </div>
      {s.budgetPct !== null && (
        <div className="bg-progress">
          <div className="progress-bar-wrap" style={{ height: 6 }}>
            <div className="progress-bar-fill" style={{ width: `${Math.min(s.budgetPct, 100)}%`, background: s.budgetPct > 100 ? 'var(--danger)' : 'var(--bar-fill)' }} />
          </div>
          <span className="progress-pct">{Math.round(s.budgetPct)}% of {fmt(project.budget)} budget</span>
        </div>
      )}
      <NetLine s={s} />
    </div>
  );
}

// ─── Add / edit project ───────────────────────────────────────────────────

export function ProjectFormModal({ existing, onSave, onClose }) {
  const { currencySymbol } = usePreferences();
  const today = new Date().toISOString().slice(0, 10);
  const [name,      setName]      = useState(existing?.name || '');
  const [startDate, setStartDate] = useState(existing?.startDate || today);
  const [budget,    setBudget]    = useState(existing?.budget ?? '');
  const [notes,     setNotes]     = useState(existing?.notes || '');
  const [color,     setColor]     = useState(existing?.color || PROJECT_COLORS[0]);
  const [busy,      setBusy]      = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onSave({ name: name.trim(), startDate, budget: parseFloat(budget) || null, notes: notes.trim() || null, color });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{existing ? 'Edit Project' : 'New Project'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
            Track a business or side project: money you put in and money it earns. Project
            transactions still update your account balances but stay out of your personal budgets and spending.
          </p>
          <div className="form-group">
            <label>Project name</label>
            <input type="text" placeholder="e.g. My new business" value={name}
              onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Startup budget ({currencySymbol}, optional)</label>
              <input type="number" min="0" step="0.01" placeholder="e.g. 3000" value={budget}
                onChange={e => setBudget(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <input type="text" placeholder="e.g. Online clothing store" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Colour</label>
            <div className="color-picker">
              {PROJECT_COLORS.map(c => (
                <button key={c} type="button" className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{existing ? 'Save Changes' : 'Create Project'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Project detail ───────────────────────────────────────────────────────

export function ProjectDetailModal({ project, transactions, accounts, onEdit, onToggleStatus, onDelete, onClose }) {
  const { fmt, fmtCur } = usePreferences();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const s = projectStats(project, transactions);
  const acctName = (id) => accounts.find(a => a.id === id)?.name || 'deleted account';
  const maxCat = s.categories[0]?.[1] || 1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="proj-dot" style={{ background: project.color }} />{project.name}
            </h3>
            <p className="acct-type" style={{ marginTop: 2 }}>
              {project.status === 'closed' ? 'Closed' : 'Active'} · since {fmtDate(project.startDate)}{project.notes ? ` · ${project.notes}` : ''}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="proj-summary">
          <div><span className="bs-label">Put in</span><b>{fmt(s.putIn)}</b></div>
          <div><span className="bs-label">Earned</span><b>{fmt(s.earned)}</b></div>
          <div><span className="bs-label">Net</span><b className={s.net >= 0 ? 'pos' : 'neg'}>{s.net >= 0 ? '+' : '−'}{fmt(Math.abs(s.net))}</b></div>
        </div>
        <NetLine s={s} />
        {s.budgetPct !== null && (
          <div className="bg-progress" style={{ margin: '10px 0 4px' }}>
            <div className="progress-bar-wrap" style={{ height: 6 }}>
              <div className="progress-bar-fill" style={{ width: `${Math.min(s.budgetPct, 100)}%`, background: s.budgetPct > 100 ? 'var(--danger)' : 'var(--bar-fill)' }} />
            </div>
            <span className="progress-pct">{Math.round(s.budgetPct)}% of {fmt(project.budget)} startup budget</span>
          </div>
        )}

        {s.categories.length > 0 && (
          <div className="proj-cats">
            <span className="bs-label">Where the money went</span>
            {s.categories.map(([cat, v]) => (
              <div key={cat} className="proj-cat-row">
                <span className="proj-cat-name"><CategoryIcon name={cat} size={13} />{cat}</span>
                <div className="proj-cat-bar"><i style={{ width: `${(v / maxCat) * 100}%`, background: project.color }} /></div>
                <b>{fmt(v)}</b>
              </div>
            ))}
          </div>
        )}

        <div className="activity-list" style={{ marginTop: 12 }}>
          {s.txs.length === 0 ? (
            <p className="accounts-empty" style={{ textAlign: 'center' }}>
              No transactions yet. When you add a transaction, choose <b>{project.name}</b> under Project.
            </p>
          ) : s.txs.map(t => (
            <div key={t.id} className="activity-row">
              <span className="activity-date">{fmtDate(t.date)}</span>
              <div className="activity-desc">
                <span>{t.description}</span>
                <small>{t.category} · {acctName(t.accountId)}</small>
              </div>
              <span className={`activity-amt ${t.type === 'income' ? 'pos' : 'neg'}`}>
                {t.type === 'income' ? '+' : '-'}{fmtCur(t.amount, t.currency)}
              </span>
            </div>
          ))}
        </div>

        <div className="form-actions" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          {confirmDelete ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--text-2)', flex: '1 1 100%' }}>
                Delete this project? Its transactions are kept in your accounts and become personal again.
              </span>
              <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}
                onClick={async () => { await onDelete(project.id); onClose(); }}>Delete project</button>
            </>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--danger)' }}>
                <Trash2 size={13} strokeWidth={1.6} /> Delete
              </button>
              <button type="button" className="btn-ghost" onClick={() => onToggleStatus(project)}>
                <Briefcase size={13} strokeWidth={1.6} /> {project.status === 'closed' ? 'Reopen' : 'Close project'}
              </button>
              <button type="button" className="btn-primary" onClick={() => onEdit(project)}>
                <Pencil size={13} strokeWidth={1.6} /> Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
