import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Calendar, ChevronDown, ClipboardList, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

const TYPE_ICON = { income: TrendingUp, expense: TrendingDown, savings: PiggyBank };
const TYPE_LABEL = { income: 'Income', expense: 'Expense', savings: 'Savings' };
function TypeBadge({ type }) {
  const Icon = TYPE_ICON[type] || TrendingDown;
  return (
    <span className="cat-badge">
      <Icon size={13} strokeWidth={1.6} color="#c8ddd5" />
      {TYPE_LABEL[type] || type}
    </span>
  );
}
import { ALL_CATEGORIES, getCategoriesForType, getCategoryInfo, EXPENSE_CATEGORIES, INCOME_CATEGORIES, SAVINGS_CATEGORIES } from '../hooks/useFinanceData';
import { fmt } from '../utils';
import CategoryIcon from './CategoryIcon';
import CategorySelect from './CategorySelect';

function TransactionModal({ onSave, onClose, transactions }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const [type, setType]         = useState('expense');
  const [description, setDesc]  = useState('');
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(today);
  const [category, setCategory] = useState('Food & Dining');
  const [warning, setWarning]   = useState(null); // { currentBalance, shortfall }

  const cats = getCategoriesForType(type);

  const handleTypeChange = (t) => {
    setType(t);
    setCategory(getCategoriesForType(t)[0].name);
    setWarning(null);
  };

  const getMonthBalance = (forDate) => {
    const month = forDate.slice(0, 7); // 'YYYY-MM'
    const monthTx = transactions.filter(t => t.date.startsWith(month));
    const income   = monthTx.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0);
    const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const savings  = monthTx.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
    return income - expenses - savings;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !amount || isNaN(amount) || Number(amount) <= 0) return;

    // Only warn for outflows that could push cash negative
    if (type === 'expense' || type === 'savings') {
      const currentBalance = getMonthBalance(date);
      const afterBalance   = currentBalance - Number(amount);
      if (afterBalance < 0) {
        setWarning({ currentBalance, shortfall: Math.abs(afterBalance) });
        return;
      }
    }

    onSave({ description, amount: Number(amount), type, category, date });
    onClose();
  };

  const confirmAnyway = () => {
    onSave({ description, amount: Number(amount), type, category, date });
    onClose();
  };

  const typeConfig = {
    expense: { label: '↓ Expense',    activeClass: 'expense-active' },
    income:  { label: '↑ Income',     activeClass: 'income-active'  },
    savings: { label: '◆ Save / Invest', activeClass: 'savings-active' },
  };

  const monthLabel = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Transaction</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {warning ? (
          <div className="modal-warning-body">
            <div className="modal-warning-icon">⚠</div>
            <h4 className="modal-warning-title">Cash Balance Will Go Negative</h4>
            <p className="modal-warning-text">
              Your current cash balance for <strong>{monthLabel}</strong> is{' '}
              <span className="mw-balance">GH₵ {warning.currentBalance.toFixed(2)}</span>.
              Adding this {type} will leave you{' '}
              <span className="mw-shortfall">GH₵ {warning.shortfall.toFixed(2)} short</span>.
            </p>
            <p className="modal-warning-hint">
              Consider recording additional income first to cover the shortfall.
            </p>
            <div className="modal-warning-actions">
              <button className="btn-secondary" onClick={() => setWarning(null)}>← Go Back</button>
              <button className="btn-warning" onClick={confirmAnyway}>Proceed Anyway</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            {/* Type toggle */}
            <div className="form-group">
              <label>Type</label>
              <div className="type-toggle">
                {Object.entries(typeConfig).map(([t, cfg]) => (
                  <button key={t} type="button"
                    className={`type-btn ${type === t ? `active ${cfg.activeClass}` : ''}`}
                    onClick={() => handleTypeChange(t)}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <input type="text" placeholder="e.g. Grocery Shopping" value={description}
                onChange={e => setDesc(e.target.value)} autoFocus required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Amount (GH₵)</label>
                <input type="number" min="0.01" step="0.01" placeholder="0.00" value={amount}
                  onChange={e => setAmount(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label>
                {type === 'income'  ? 'Income Source' :
                 type === 'savings' ? 'Account / Instrument' :
                 'Category'}
              </label>
              <CategorySelect categories={cats} value={category} onChange={setCategory} />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Add Transaction</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CategoryDropdown({ value, onChange, categories }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="cat-dropdown" ref={ref}>
      <button className="cat-dropdown-trigger" onClick={() => setOpen(o => !o)}>
        <span className="cat-dropdown-selected">
          {value === 'All' ? (
            <span className="cat-dropdown-label">All Categories</span>
          ) : (
            <>
              <CategoryIcon name={value} size={13} />
              <span className="cat-dropdown-label">{value}</span>
            </>
          )}
        </span>
        <ChevronDown size={13} strokeWidth={1.6} color="#c8ddd5"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.18s ease' }} />
      </button>
      {open && (
        <div className="cat-dropdown-menu">
          <div className="cat-dropdown-item" onClick={() => { onChange('All'); setOpen(false); }}>
            <span className="cat-dropdown-label" style={{ paddingLeft: 2 }}>All Categories</span>
          </div>
          {categories.map(c => (
            <div key={c.name} className={`cat-dropdown-item ${value === c.name ? 'active' : ''}`}
              onClick={() => { onChange(c.name); setOpen(false); }}>
              <CategoryIcon name={c.name} size={13} />
              <span className="cat-dropdown-label">{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Transactions({ transactions, addTransaction, deleteTransaction }) {
  const now = new Date();
  const [showModal, setShowModal]           = useState(false);
  const [filterMonth, setFilterMonth]       = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType]         = useState('All');
  const [search, setSearch]                 = useState('');

  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        if (filterMonth && !t.date.startsWith(filterMonth)) return false;
        if (filterCategory !== 'All' && t.category !== filterCategory) return false;
        if (filterType !== 'All' && t.type !== filterType) return false;
        if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, filterMonth, filterCategory, filterType, search]);

  const totalIncome   = filtered.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalSavings  = filtered.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);

  const typeLabelMap = { income: '↑ Income', expense: '↓ Expense', savings: '◆ Savings' };
  const typeSignMap  = { income: '+', expense: '-', savings: '→ ' };

  const isFiltered = filterCategory !== 'All' || filterType !== 'All' || search;

  // Categories shown in dropdown depend on selected type
  const dropdownCategories = filterType === 'All' ? ALL_CATEGORIES : getCategoriesForType(filterType);

  // Reset category filter when type changes and current category doesn't belong to new type
  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setFilterType(newType);
    if (newType !== 'All') {
      const cats = getCategoriesForType(newType);
      if (filterCategory !== 'All' && !cats.find(c => c.name === filterCategory)) {
        setFilterCategory('All');
      }
    }
  };

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h2>Transactions</h2>
        <button className="btn-pill" onClick={() => setShowModal(true)}>
          + Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={15} strokeWidth={1.6} color="#c8ddd5" className="search-icon" />
          <input className="search-input" type="text" placeholder="Search descriptions..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="date-wrap">
          <Calendar size={15} strokeWidth={1.6} color="#c8ddd5" className="date-icon" />
          <input className="filter-month" type="month" value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)} />
        </div>
        <CategoryDropdown value={filterCategory} onChange={setFilterCategory} categories={dropdownCategories} />
        <select value={filterType} onChange={handleTypeChange}>
          <option value="All">All Types</option>
          <option value="income">↑ Income</option>
          <option value="expense">↓ Expense</option>
          <option value="savings">◆ Savings</option>
        </select>
        {isFiltered && (
          <button className="btn-ghost" onClick={() => { setFilterCategory('All'); setFilterType('All'); setSearch(''); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div className="tx-summary">
        <span className="tx-count">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
        <span className="tx-income">↑ {fmt(totalIncome)}</span>
        <span className="tx-expense">↓ {fmt(totalExpenses)}</span>
        <span className="tx-savings">◆ {fmt(totalSavings)}</span>
        <span className={`tx-net ${totalIncome - totalExpenses - totalSavings >= 0 ? 'pos' : 'neg'}`}>
          Cash: {fmt(totalIncome - totalExpenses - totalSavings)}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><ClipboardList size={48} strokeWidth={1.2} color="#456054" /></div>
          <h3>No transactions found</h3>
          <p>Try adjusting your filters or add a new transaction.</p>
        </div>
      ) : (
        <div className="tx-table-wrap">
          <table className="tx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category / Account</th>
                <th>Type</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const cat = getCategoryInfo(t.category);
                return (
                  <tr key={t.id} className="tx-row">
                    <td className="tx-date">
                      {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="tx-desc">{t.description}</td>
                    <td className="tx-cat">
                      <span className="cat-badge">
                        <CategoryIcon name={t.category} size={13} />
                        {t.category}
                      </span>
                    </td>
                    <td><TypeBadge type={t.type} /></td>
                    <td className={`tx-amount ${t.type}`}>
                      {typeSignMap[t.type] || ''}{fmt(t.amount)}
                    </td>
                    <td>
                      <button className="icon-btn delete-btn" onClick={() => deleteTransaction(t.id)} title="Delete">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <TransactionModal onSave={addTransaction} onClose={() => setShowModal(false)} transactions={transactions} />
      )}
    </div>
  );
}
