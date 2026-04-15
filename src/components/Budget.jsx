import { useState, useMemo } from 'react';
import { Wallet } from 'lucide-react';
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, SAVINGS_CATEGORIES,
  getCategoriesForType,
} from '../hooks/useFinanceData';
import { fmt } from '../utils';
import CategoryIcon from './CategoryIcon';
import CategorySelect from './CategorySelect';

const TYPE_CONFIG = {
  expense: { label: '↓ Expense', activeClass: 'expense-active' },
  income:  { label: '↑ Income',  activeClass: 'income-active'  },
  savings: { label: '◆ Savings', activeClass: 'savings-active' },
};

function BudgetModal({ month, existing, onSave, onClose }) {
  const [type, setType]         = useState(existing?.type || 'expense');
  const [category, setCategory] = useState(
    existing?.category || getCategoriesForType(existing?.type || 'expense')[0]?.name || ''
  );
  const [amount, setAmount] = useState(existing?.amount || '');

  const cats = getCategoriesForType(type);

  const handleTypeChange = (t) => {
    setType(t);
    setCategory(getCategoriesForType(t)[0]?.name || '');
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
            <label>Monthly Budget (GH₵)</label>
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
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);

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

  // Spending keyed by "type:category" to support all budget types
  const spending = useMemo(() => {
    const result = {};
    transactions
      .filter(t => t.date.startsWith(monthStr))
      .forEach(t => {
        const key = `${t.type}:${t.category}`;
        result[key] = (result[key] || 0) + t.amount;
      });
    return result;
  }, [transactions, monthStr]);

  const monthBudgets = useMemo(() =>
    budgets.filter(b => b.month === monthStr),
    [budgets, monthStr]
  );

  const totalBudget = monthBudgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent  = monthBudgets.reduce((s, b) => s + (spending[`${b.type || 'expense'}:${b.category}`] || 0), 0);

  const openAdd  = () => { setEditing(null); setShowModal(true); };
  const openEdit = (b) => { setEditing(b); setShowModal(true); };

  const alreadySet = new Set(monthBudgets.map(b => `${b.type || 'expense'}:${b.category}`));
  const allPossible = [
    ...EXPENSE_CATEGORIES.map(c => `expense:${c.name}`),
    ...INCOME_CATEGORIES.map(c => `income:${c.name}`),
    ...SAVINGS_CATEGORIES.map(c => `savings:${c.name}`),
  ];
  const canAdd = allPossible.some(key => !alreadySet.has(key));

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

      {/* Summary bar */}
      {monthBudgets.length > 0 && (
        <div className="budget-summary">
          <div className="budget-summary-item">
            <span className="bs-label">Total Budget</span>
            <span className="bs-value">{fmt(totalBudget)}</span>
          </div>
          <div className="budget-summary-item">
            <span className="bs-label">Total Spent</span>
            <span className="bs-value spent">{fmt(totalSpent)}</span>
          </div>
          <div className="budget-summary-item">
            <span className="bs-label">Remaining</span>
            <span className={`bs-value ${totalBudget - totalSpent >= 0 ? 'remaining' : 'over'}`}>
              {fmt(totalBudget - totalSpent)}
            </span>
          </div>
          <div className="budget-summary-progress">
            <div className="progress-bar-wrap" style={{ height: '8px' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%`,
                  background: '#ffffff'
                }}
              />
            </div>
            <span className="progress-pct">
              {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% used
            </span>
          </div>
        </div>
      )}

      {/* Budget Cards */}
      {monthBudgets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Wallet size={48} strokeWidth={1.2} color="#456054" /></div>
          <h3>No budgets set</h3>
          <p>Set monthly budgets to track your spending against goals.</p>
          <button className="btn-pill" onClick={openAdd}>Add Your First Budget</button>
        </div>
      ) : (
        <div className="budget-grid">
          {monthBudgets.map(b => {
            const btype = b.type || 'expense';
            const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SAVINGS_CATEGORIES];
            const cat   = allCats.find(c => c.name === b.category);
            const spent = spending[`${btype}:${b.category}`] || 0;
            const pct   = Math.min((spent / b.amount) * 100, 100);
            const over  = spent > b.amount;
            const warn  = pct >= 70 && !over;
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
                      <span className={`bc-type-badge ${btype}`}>{TYPE_CONFIG[btype]?.label || btype}</span>
                    </div>
                  </div>
                  <div className="bc-actions">
                    <button className="icon-btn edit-btn" onClick={() => openEdit(b)} title="Edit">✎</button>
                    <button className="icon-btn delete-btn" onClick={() => deleteBudget(b.id)} title="Delete">✕</button>
                  </div>
                </div>

                <div className="bc-amounts">
                  <div>
                    <span className="bc-amt-label">Spent</span>
                    <span className={`bc-amt-val ${over ? 'over-budget' : ''}`}>{fmt(spent)}</span>
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
                  <span className={`bc-status ${over ? 'over' : warn ? 'warn' : 'ok'}`}>
                    {over ? `Over by ${fmt(spent - b.amount)}` : `${fmt(b.amount - spent)} left`}
                  </span>
                  <span className="bc-pct">{Math.round(pct)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <BudgetModal
          month={monthStr}
          existing={editing}
          onSave={upsertBudget}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
