import { useState, useMemo } from 'react';
import { Wallet, ChevronRight } from 'lucide-react';
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, SAVINGS_CATEGORIES,
  getCategoriesForType,
} from '../hooks/useFinanceData';
import { useFmt, usePreferences, useEffectiveCategoriesForType } from '../contexts/PreferencesContext';
import CategoryIcon from './CategoryIcon';
import CategorySelect from './CategorySelect';

// Wording per budget type: what "used" and "left" mean, and whether going over is good or bad
const GROUPS = [
  { type: 'income',  title: 'Income',   used: 'Received', left: 'Still to receive', overGood: true  },
  { type: 'expense', title: 'Expenses', used: 'Spent',    left: 'Left to spend',    overGood: false },
  { type: 'savings', title: 'Savings',  used: 'Saved',    left: 'Still to save',    overGood: true  },
];

const TYPE_CONFIG = {
  expense: { label: '↓ Expense', activeClass: 'expense-active' },
  income:  { label: '↑ Income',  activeClass: 'income-active'  },
  savings: { label: '◆ Savings', activeClass: 'savings-active' },
};

function BudgetModal({ month, existing, defaultType = 'expense', onSave, onClose }) {
  const [type, setType]         = useState(existing?.type || defaultType);
  const [category, setCategory] = useState(
    existing?.category || getCategoriesForType(existing?.type || defaultType)[0]?.name || ''
  );
  const [amount, setAmount] = useState(existing?.amount || '');
  const { currencySymbol } = usePreferences();

  const expenseCats = useEffectiveCategoriesForType('expense');
  const incomeCats  = useEffectiveCategoriesForType('income');
  const savingsCats = useEffectiveCategoriesForType('savings');
  const catsByType  = { expense: expenseCats, income: incomeCats, savings: savingsCats };
  const cats = catsByType[type] || expenseCats;

  const handleTypeChange = (t) => {
    setType(t);
    setCategory((catsByType[t] || expenseCats)[0]?.name || '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || Number(amount) <= 0) return;
    onSave({ type, category, amount: Number(amount), month });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{existing ? 'Edit Budget' : 'Set Budget'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          {!existing && (
            <div className="form-group">
              <label>Type</label>
              <div className="type-toggle">
                {Object.entries(TYPE_CONFIG).map(([t, cfg]) => (
                  <button key={t} type="button"
                    className={`type-btn ${type === t ? `active ${cfg.activeClass}` : ''}`}
                    onClick={() => handleTypeChange(t)}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Category</label>
            <CategorySelect categories={cats} value={category} onChange={setCategory} disabled={!!existing} />
          </div>
          <div className="form-group">
            <label>Monthly Budget ({currencySymbol})</label>
            <input type="number" min="1" step="1" placeholder="0"
              value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{existing ? 'Update Budget' : 'Set Budget'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Budget({ budgets, transactions, upsertBudget, deleteBudget }) {
  const fmt = useFmt();
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeType, setActiveType] = useState('expense');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Actuals keyed by "type:category" to support all budget types
  const spending = useMemo(() => {
    const result = {};
    transactions
      .filter(t => t.date.startsWith(monthStr))
      .forEach(t => {
        const key = `${t.type}:${t.category}`;
        result[key] = (result[key] || 0) + t.baseAmount;   // budgets are in the base currency
      });
    return result;
  }, [transactions, monthStr]);

  const monthBudgets = useMemo(() =>
    budgets.filter(b => b.month === monthStr),
    [budgets, monthStr]
  );

  // Budgeted vs actual, aggregated per type (only categories that have a budget count)
  const totals = useMemo(() => Object.fromEntries(GROUPS.map(g => {
    const list     = monthBudgets.filter(b => (b.type || 'expense') === g.type);
    const budgeted = list.reduce((s, b) => s + b.amount, 0);
    const used     = list.reduce((s, b) => s + (spending[`${g.type}:${b.category}`] || 0), 0);
    return [g.type, { list, budgeted, used, count: list.length }];
  })), [monthBudgets, spending]);

  const openAdd  = () => { setEditing(null); setShowModal(true); };
  const openEdit = (b) => { setEditing(b); setShowModal(true); };

  const alreadySet = new Set(monthBudgets.map(b => `${b.type || 'expense'}:${b.category}`));
  const allPossible = [
    ...EXPENSE_CATEGORIES.map(c => `expense:${c.name}`),
    ...INCOME_CATEGORIES.map(c => `income:${c.name}`),
    ...SAVINGS_CATEGORIES.map(c => `savings:${c.name}`),
  ];
  const canAdd = allPossible.some(key => !alreadySet.has(key));

  const group  = GROUPS.find(g => g.type === activeType);
  const active = totals[activeType];

  return (
    <div className="budget-page">
      <div className="page-header">
        <div className="month-nav">
          <button className="nav-btn" onClick={prevMonth}>‹</button>
          <h2>{monthName}</h2>
          <button className="nav-btn" onClick={nextMonth}>›</button>
        </div>
        {canAdd && (
          <button className="btn-pill" onClick={openAdd}>
            + Add Budget
          </button>
        )}
      </div>

      {monthBudgets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Wallet size={48} strokeWidth={1.2} color="#456054" /></div>
          <h3>No budgets set</h3>
          <p>Set monthly budgets to track your spending against goals.</p>
          <button className="btn-pill" onClick={openAdd}>Add Your First Budget</button>
        </div>
      ) : (
        <>
          {/* ── Per-type totals: click one to show its budgets ── */}
          <div className="budget-groups">
            {GROUPS.map(g => {
              const t      = totals[g.type];
              const left   = t.budgeted - t.used;
              const over   = left < 0;
              const pct    = t.budgeted > 0 ? (t.used / t.budgeted) * 100 : 0;
              const status = over ? (g.overGood ? 'good' : 'bad') : 'neutral';
              return (
                <button key={g.type} type="button"
                  className={`budget-group-card ${activeType === g.type ? 'active' : ''}`}
                  onClick={() => setActiveType(g.type)}>
                  <div className="bg-head">
                    <span className="bg-title">{g.title}</span>
                    <span className="bg-count">
                      {t.count} {t.count === 1 ? 'budget' : 'budgets'}
                      <ChevronRight size={13} strokeWidth={1.8} />
                    </span>
                  </div>
                  {t.count === 0 ? (
                    <span className="bg-empty">No {g.title.toLowerCase()} budgets this month</span>
                  ) : (
                    <>
                      <div className="bg-figures">
                        <div>
                          <span className="bs-label">Budgeted</span>
                          <span className="bg-val">{fmt(t.budgeted)}</span>
                        </div>
                        <div>
                          <span className="bs-label">{g.used}</span>
                          <span className="bg-val">{fmt(t.used)}</span>
                        </div>
                        <div>
                          <span className="bs-label">{over ? (g.overGood ? 'Ahead by' : 'Over by') : g.left}</span>
                          <span className={`bg-val ${status}`}>{fmt(Math.abs(left))}</span>
                        </div>
                      </div>
                      <div className="bg-progress">
                        <div className="progress-bar-wrap" style={{ height: 6 }}>
                          <div className="progress-bar-fill"
                            style={{ width: `${Math.min(pct, 100)}%`, background: status === 'bad' ? 'var(--danger)' : '#ffffff' }} />
                        </div>
                        <span className="progress-pct">{Math.round(pct)}% {g.used.toLowerCase()}</span>
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Budgets for the selected type ── */}
          <div className="section-header">
            <h3>{group.title} budgets</h3>
          </div>
          {active.count === 0 ? (
            <div className="empty-state-sm" style={{ padding: '24px 0' }}>
              No {group.title.toLowerCase()} budgets for {monthName}.{' '}
              <button type="button" className="auth-switch-link" onClick={openAdd}>Add one</button>
            </div>
          ) : (
            <div className="budget-grid">
              {active.list.map(b => {
                const spent = spending[`${activeType}:${b.category}`] || 0;
                const pct   = Math.min((spent / b.amount) * 100, 100);
                const over  = spent > b.amount;
                const warn  = pct >= 70 && !over && !group.overGood;
                const barColor = '#ffffff';

                return (
                  <div key={b.id} className="budget-card">
                    <div className="bc-header">
                      <div className="bc-cat">
                        <div
                          className="bc-icon-ring"
                          style={{ '--pct': `${pct}%`, '--ring-color': '#00a854' }}
                        >
                          <div className="bc-icon-inner">
                            <CategoryIcon name={b.category} size={19} />
                          </div>
                        </div>
                        <div>
                          <span className="bc-name">{b.category}</span>
                        </div>
                      </div>
                      <div className="bc-actions">
                        <button className="icon-btn edit-btn" onClick={() => openEdit(b)} title="Edit">✎</button>
                        <button className="icon-btn delete-btn" onClick={() => deleteBudget(b.id)} title="Delete">✕</button>
                      </div>
                    </div>

                    <div className="bc-amounts">
                      <div>
                        <span className="bc-amt-label">{group.used}</span>
                        <span className={`bc-amt-val ${over && !group.overGood ? 'over-budget' : ''}`}>{fmt(spent)}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="bc-amt-label">Budget</span>
                        <span className="bc-amt-val">{fmt(b.amount)}</span>
                      </div>
                    </div>

                    <div className="progress-bar-wrap">
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                    </div>

                    <div className="bc-footer">
                      <span className={`bc-status ${over ? (group.overGood ? 'ok' : 'over') : warn ? 'warn' : 'ok'}`}>
                        {over
                          ? `${group.overGood ? 'Ahead by' : 'Over by'} ${fmt(spent - b.amount)}`
                          : `${fmt(b.amount - spent)} ${group.left.toLowerCase()}`}
                      </span>
                      <span className="bc-pct">{Math.round(pct)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showModal && (
        <BudgetModal
          month={monthStr}
          existing={editing}
          defaultType={activeType}
          onSave={upsertBudget}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
