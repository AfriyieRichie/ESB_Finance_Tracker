import { useState, useMemo } from 'react';
import { ALL_CATEGORIES, getCategoriesForType, getCategoryInfo } from '../hooks/useFinanceData';
import { fmt } from '../utils';

function TransactionModal({ onSave, onClose }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const [type, setType]         = useState('expense');
  const [description, setDesc]  = useState('');
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(today);
  const [category, setCategory] = useState('Food & Dining');

  const cats = getCategoriesForType(type);

  // Reset category to first of the new type's list when type changes
  const handleTypeChange = (t) => {
    setType(t);
    setCategory(getCategoriesForType(t)[0].name);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !amount || isNaN(amount) || Number(amount) <= 0) return;
    onSave({ description, amount: Number(amount), type, category, date });
    onClose();
  };

  const typeConfig = {
    expense: { label: '↓ Expense',    activeClass: 'expense-active' },
    income:  { label: '↑ Income',     activeClass: 'income-active'  },
    savings: { label: '◆ Save / Invest', activeClass: 'savings-active' },
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Transaction</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
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
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {cats.map(c => (
                <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Add Transaction</button>
          </div>
        </form>
      </div>
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

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h2>Transactions</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <span>+</span> Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input className="search-input" type="text" placeholder="🔍 Search descriptions..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <input className="filter-month" type="month" value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)} />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {ALL_CATEGORIES.map(c => (
            <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
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
          <div className="empty-icon">📋</div>
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
                      <span className="cat-badge" style={{ background: cat.color + '22', color: cat.color }}>
                        {cat.icon} {t.category}
                      </span>
                    </td>
                    <td>
                      <span className={`type-badge ${t.type}`}>
                        {typeLabelMap[t.type] || t.type}
                      </span>
                    </td>
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
        <TransactionModal onSave={addTransaction} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
