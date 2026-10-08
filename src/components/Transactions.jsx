import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Calendar, ChevronDown, ClipboardList, TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight, Pencil } from 'lucide-react';

const TYPE_ICON  = { income: TrendingUp, expense: TrendingDown, savings: PiggyBank, transfer: ArrowLeftRight };
const TYPE_LABEL = { income: 'Income', expense: 'Expense', savings: 'Savings', transfer: 'Transfer' };
function TypeBadge({ type }) {
  const Icon = TYPE_ICON[type] || TrendingDown;
  return (
    <span className="cat-badge">
      <Icon size={13} strokeWidth={1.6} className="ico" />
      {TYPE_LABEL[type] || type}
    </span>
  );
}
import { usePreferences, useEffectiveCategoriesForType, symbolFor } from '../contexts/PreferencesContext';
import { BaseApprox } from './CurrencySelect';
import CategoryIcon from './CategoryIcon';
import CategorySelect from './CategorySelect';

function TransactionModal({ onSave, onUpdate, onClose, accounts, debts, assets, projects = [], addTransfer, budgets, existing }) {
  const { fmtCur, convert, txFxMeta } = usePreferences();
  const expenseCats = useEffectiveCategoriesForType('expense');
  const incomeCats  = useEffectiveCategoriesForType('income');
  const savingsCats = useEffectiveCategoriesForType('savings');
  const bizCostCats = useEffectiveCategoriesForType('business-expense');
  const bizIncCats  = useEffectiveCategoriesForType('business-income');
  const catsByType  = { expense: expenseCats, income: incomeCats, savings: savingsCats };
  // Project transactions use business categories: income → business income, anything else → costs
  const catsFor = (t, proj) => proj ? (t === 'income' ? bizIncCats : bizCostCats) : (catsByType[t] || expenseCats);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const isEdit = !!existing;

  const [type,        setType]    = useState(existing?.type || 'expense');
  const [description, setDesc]    = useState(existing?.description || '');
  const [amount,      setAmount]  = useState(existing?.amount != null ? String(existing.amount) : '');
  const [date,        setDate]    = useState(existing?.date || today);
  const [category,    setCategory]= useState(existing?.category || expenseCats[0]?.name || 'Food & Dining');
  const [accountId,   setAccountId]=useState(existing?.accountId || accounts[0]?.id || '');
  const [debtId,      setDebtId]  = useState(existing?.debtId || '');
  const [assetId,     setAssetId] = useState(existing?.assetId || '');
  const [projectId,   setProjectId] = useState(existing?.projectId || '');
  const [warning,     setWarning] = useState(null);
  const [miniFrom,    setMiniFrom]= useState('');
  const [miniAmt,     setMiniAmt] = useState('');
  const [miniBusy,    setMiniBusy]= useState(false);

  const cats        = catsFor(type, projectId);
  const activeAssets = assets.filter(a => a.status === 'active');
  const isDebtRepay  = category === 'Debt Repayment';

  const hasBudget = budgets.some(
    b => b.category === category && b.month === date.slice(0, 7) && (b.type || 'expense') === type
  );

  const handleTypeChange = (t) => {
    setType(t);
    setCategory(catsFor(t, projectId)[0]?.name || '');
    setWarning(null);
    setDebtId('');
    setAssetId('');
  };

  const account  = accounts.find(a => a.id === accountId);
  const currency = account?.currency;
  const linkedDebt  = isDebtRepay && debtId ? debts.find(d => d.id === debtId) : null;
  const linkedAsset = type === 'savings' && assetId ? assets.find(a => a.id === assetId) : null;

  // Amount in a linked debt's/asset's own currency, when it differs from the account's
  const linkedAmount = (target) => {
    if (!target || !currency || target.currency === currency || !amount) return null;
    const v = convert(Number(amount), currency, target.currency);
    return v === null ? null : Math.round(v * 100) / 100;
  };
  const debtAmount  = linkedAmount(linkedDebt);
  const assetAmount = linkedAmount(linkedAsset);

  const buildTx = () => {
    // Keep the original rate when editing within the same currency, so history doesn't drift
    const fx = isEdit && existing.currency === currency && typeof existing.fxRate === 'number'
      ? { currency, baseCurrency: existing.baseCurrency, fxRate: existing.fxRate }
      : txFxMeta(currency);
    const tx = { description, amount: Number(amount), type, category, date, accountId, ...fx };
    if (linkedDebt) {
      tx.debtId = debtId;
      if (debtAmount !== null) tx.debtAmount = debtAmount;
    }
    if (linkedAsset) {
      tx.assetId = assetId;
      if (assetAmount !== null) tx.assetAmount = assetAmount;
    }
    if (projectId) tx.projectId = projectId;
    return tx;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !amount || isNaN(amount) || Number(amount) <= 0) return;
    if (!accountId) return;

    // Balance check only when adding (not editing)
    if (!isEdit && (type === 'expense' || type === 'savings')) {
      const selectedAccount = accounts.find(a => a.id === accountId);
      if (selectedAccount && selectedAccount.balance < Number(amount)) {
        setWarning({ account: selectedAccount, shortfall: Number(amount) - selectedAccount.balance });
        setMiniFrom('');
        setMiniAmt('');
        return;
      }
    }

    if (isEdit) {
      onUpdate(existing, buildTx());
    } else {
      onSave(buildTx());
    }
    onClose();
  };

  const confirmAnyway = () => { onSave(buildTx()); onClose(); };

  // Mini top-up: miniAmt is what should arrive in this account; the source pays the converted amount
  const miniSource   = accounts.find(a => a.id === miniFrom);
  const miniCross    = miniSource && miniSource.currency !== currency;
  const miniSendAmt  = miniSource && miniAmt
    ? (miniCross ? convert(parseFloat(miniAmt), currency, miniSource.currency) : parseFloat(miniAmt))
    : null;

  const handleMiniTransfer = async () => {
    if (!miniFrom || !miniAmt || miniSendAmt === null) return;
    setMiniBusy(true);
    await addTransfer({
      ...txFxMeta(miniSource.currency),
      fromAccountId: miniFrom,
      toAccountId:   accountId,
      amount:        Math.round(miniSendAmt * 100) / 100,
      ...(miniCross ? { toAmount: parseFloat(miniAmt), toCurrency: currency } : {}),
      description:   'Transfer',
      date,
    });
    setMiniBusy(false);
    setWarning(null);
  };

  const typeConfig = {
    expense: { label: '↓ Expense',    activeClass: 'expense-active' },
    income:  { label: '↑ Income',     activeClass: 'income-active'  },
    savings: { label: '◆ Save / Invest', activeClass: 'savings-active' },
  };

  const otherAccounts = accounts.filter(a => a.id !== accountId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Transaction' : 'Add Transaction'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {warning ? (
          <div className="modal-warning-body">
            <div className="modal-warning-icon">⚠</div>
            <h4 className="modal-warning-title">Insufficient Account Balance</h4>
            <p className="modal-warning-text">
              <strong>{warning.account.name}</strong> only has{' '}
              <span className="mw-balance">{fmtCur(warning.account.balance, warning.account.currency)}</span> available.
              You need{' '}
              <span className="mw-shortfall">{fmtCur(warning.shortfall, warning.account.currency)} more</span> to complete this transaction.
            </p>
            {otherAccounts.length > 0 && (
              <>
                <p className="modal-warning-hint">Top up from another account first:</p>
                <div className="mini-transfer">
                  <select value={miniFrom} onChange={e => setMiniFrom(e.target.value)}>
                    <option value="">— From account —</option>
                    {otherAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({fmtCur(a.balance, a.currency)})</option>
                    ))}
                  </select>
                  <input
                    type="number" min="0.01" step="0.01"
                    placeholder={fmtCur(warning.shortfall, warning.account.currency)}
                    value={miniAmt}
                    onChange={e => setMiniAmt(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ whiteSpace: 'nowrap' }}
                    disabled={!miniFrom || !miniAmt || miniBusy || miniSendAmt === null}
                    onClick={handleMiniTransfer}
                  >
                    {miniBusy ? '…' : 'Transfer'}
                  </button>
                </div>
                {miniCross && miniAmt && (
                  <p className="fx-hint">
                    {miniSendAmt === null
                      ? `No ${miniSource.currency}/${currency} rate available.`
                      : `≈ ${fmtCur(miniSendAmt, miniSource.currency)} will leave ${miniSource.name} at today's rate.`}
                  </p>
                )}
              </>
            )}
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
                <label>Amount{currency ? ` (${symbolFor(currency)})` : ''}</label>
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
                 type === 'savings' ? 'Savings Category' :
                 'Category'}
              </label>
              <CategorySelect categories={cats} value={category} onChange={v => { setCategory(v); setDebtId(''); }} />
              {!hasBudget && !projectId && (
                <p className="no-budget-hint">
                  No budget set for <strong>{category}</strong> in this month.{' '}
                  <span>Go to the Budget tab to add one.</span>
                </p>
              )}
            </div>

            <div className="form-group">
              <label>{type === 'income' ? 'Receiving Account' : 'Paying From Account'}</label>
              {accounts.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--warning)' }}>No accounts yet. Add one in the Accounts tab first.</p>
              ) : (
                <select value={accountId} onChange={e => setAccountId(e.target.value)} required>
                  <option value="">— Select account —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Project: business costs and income are tracked there, not in personal budgets */}
            {(projects.some(p => p.status !== 'closed') || projectId) && (
              <div className="form-group">
                <label>Project (optional)</label>
                <select value={projectId} onChange={e => {
                  const next = e.target.value;
                  setProjectId(next);
                  // switching between personal and business: pick a category from the right list
                  const list = catsFor(type, next);
                  if (!list.some(c => c.name === category)) setCategory(list[0]?.name || '');
                }}>
                  <option value="">— Personal (no project) —</option>
                  {projects.filter(p => p.status !== 'closed' || p.id === projectId).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {projectId && (
                  <p className="fx-hint">Counted in this project, not in your personal budgets or spending.</p>
                )}
              </div>
            )}

            {isDebtRepay && debts.length > 0 && (
              <div className="form-group">
                <label>Linked Debt (optional)</label>
                <select value={debtId} onChange={e => setDebtId(e.target.value)}>
                  <option value="">— Select debt —</option>
                  {debts.map(d => (
                    <option key={d.id} value={d.id}>{d.name} · {d.currency}</option>
                  ))}
                </select>
                {linkedDebt && linkedDebt.currency !== currency && amount && (
                  <p className="fx-hint">
                    {debtAmount === null
                      ? `No rate available. The debt will be reduced by the same number in ${linkedDebt.currency}.`
                      : `≈ ${fmtCur(debtAmount, linkedDebt.currency)} will come off this debt.`}
                  </p>
                )}
              </div>
            )}

            {type === 'savings' && activeAssets.length > 0 && (
              <div className="form-group">
                <label>Link to Asset (optional)</label>
                <select value={assetId} onChange={e => setAssetId(e.target.value)}>
                  <option value="">— None —</option>
                  {activeAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>
                  ))}
                </select>
                {linkedAsset && linkedAsset.currency !== currency && amount && (
                  <p className="fx-hint">
                    {assetAmount === null
                      ? `No rate available. The asset will grow by the same number in ${linkedAsset.currency}.`
                      : `≈ ${fmtCur(assetAmount, linkedAsset.currency)} will be added to this asset.`}
                  </p>
                )}
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!accountId}>{isEdit ? 'Save Changes' : 'Add Transaction'}</button>
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
    <div className={`cat-dropdown ${open ? 'open' : ''}`} ref={ref}>
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
        <ChevronDown size={13} strokeWidth={1.6} className="ico"
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

// Same look and behaviour as the category filter, for plain option lists (type, account)
function FilterDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = options.find(o => o.value === value) || options[0];

  return (
    <div className={`cat-dropdown ${open ? 'open' : ''}`} ref={ref}>
      <button className="cat-dropdown-trigger" onClick={() => setOpen(o => !o)}>
        <span className="cat-dropdown-selected">
          <span className="cat-dropdown-label">{current.label}</span>
        </span>
        <ChevronDown size={13} strokeWidth={1.6} className="ico"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.18s ease' }} />
      </button>
      {open && (
        <div className="cat-dropdown-menu">
          {options.map(o => (
            <div key={o.value} className={`cat-dropdown-item ${value === o.value ? 'active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              <span className="cat-dropdown-label" style={{ paddingLeft: 2 }}>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TYPE_FILTER_OPTIONS = [
  { value: 'All',      label: 'All Types' },
  { value: 'income',   label: '↑ Income' },
  { value: 'expense',  label: '↓ Expense' },
  { value: 'savings',  label: '◆ Savings' },
  { value: 'transfer', label: '⇄ Transfer' },
];

export default function Transactions({ transactions, addTransaction, updateTransaction, deleteTransaction, accounts, debts, assets, projects = [], addTransfer, budgets }) {
  const { fmt, fmtCur } = usePreferences();
  const expenseCats = useEffectiveCategoriesForType('expense');
  const incomeCats  = useEffectiveCategoriesForType('income');
  const savingsCats = useEffectiveCategoriesForType('savings');
  const bizCostCats = useEffectiveCategoriesForType('business-expense');
  const bizIncCats  = useEffectiveCategoriesForType('business-income');
  const allEffectiveCats = [...expenseCats, ...incomeCats, ...savingsCats,
    ...(projects.length ? [...bizCostCats, ...bizIncCats] : [])];

  const now = new Date();
  const [showModal, setShowModal]           = useState(false);
  const [editingTx,  setEditingTx]          = useState(null);
  const [filterMonth, setFilterMonth]       = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType]         = useState('All');
  const [filterAccount, setFilterAccount]   = useState('All');
  const [filterProject, setFilterProject]   = useState('All');   // 'All' | 'personal' | project id
  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  const [search, setSearch]                 = useState('');

  const acctMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);

  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        if (filterMonth && !t.date.startsWith(filterMonth)) return false;
        if (filterCategory !== 'All' && t.category !== filterCategory) return false;
        if (filterType !== 'All' && t.type !== filterType) return false;
        // Transfers belong to both the sending and the receiving account
        if (filterAccount !== 'All' && t.accountId !== filterAccount && t.toAccountId !== filterAccount) return false;
        if (filterProject === 'personal' && t.projectId) return false;
        if (filterProject !== 'All' && filterProject !== 'personal' && t.projectId !== filterProject) return false;
        if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, filterMonth, filterCategory, filterType, filterAccount, filterProject, search]);

  // Totals in the base currency
  const totalIncome   = filtered.filter(t => t.type === 'income').reduce((s, t)  => s + t.baseAmount, 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.baseAmount, 0);
  const totalSavings  = filtered.filter(t => t.type === 'savings').reduce((s, t) => s + t.baseAmount, 0);

  const typeSignMap  = { income: '+', expense: '-', savings: '→ ', transfer: '' };

  const isFiltered = filterCategory !== 'All' || filterType !== 'All' || filterAccount !== 'All' || filterProject !== 'All' || search;

  // Categories shown in dropdown depend on selected type
  const dropdownCategories = filterType === 'All' ? allEffectiveCats
    : filterType === 'income' ? [...incomeCats, ...(projects.length ? bizIncCats : [])]
    : filterType === 'savings' ? savingsCats
    : [...expenseCats, ...(projects.length ? bizCostCats : [])];

  // Reset category filter when type changes and current category doesn't belong to new type
  const handleTypeChange = (newType) => {
    setFilterType(newType);
    if (newType !== 'All') {
      const cats = newType === 'income' ? [...incomeCats, ...bizIncCats]
        : newType === 'savings' ? savingsCats
        : [...expenseCats, ...bizCostCats];
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
          <Search size={15} strokeWidth={1.6} className="ico search-icon" />
          <input className="search-input" type="text" placeholder="Search descriptions..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="date-wrap">
          <Calendar size={15} strokeWidth={1.6} className="ico date-icon" />
          <input className="filter-month" type="month" value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)} />
        </div>
        <CategoryDropdown value={filterCategory} onChange={setFilterCategory} categories={dropdownCategories} />
        <FilterDropdown value={filterType} onChange={handleTypeChange} options={TYPE_FILTER_OPTIONS} />
        <FilterDropdown value={filterAccount} onChange={setFilterAccount}
          options={[{ value: 'All', label: 'All Accounts' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]} />
        {projects.length > 0 && (
          <FilterDropdown value={filterProject} onChange={setFilterProject}
            options={[{ value: 'All', label: 'All Projects' }, { value: 'personal', label: 'Personal only' },
              ...projects.map(p => ({ value: p.id, label: p.name }))]} />
        )}
        {isFiltered && (
          <button className="btn-ghost" onClick={() => { setFilterCategory('All'); setFilterType('All'); setFilterAccount('All'); setFilterProject('All'); setSearch(''); }}>
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
          <div className="empty-icon"><ClipboardList size={48} strokeWidth={1.2} className="ico-muted" /></div>
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
                const isTransfer = t.type === 'transfer';
                return (
                  <tr key={t.id} className="tx-row">
                    <td className="tx-date">
                      {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="tx-desc">{t.description}</td>
                    <td className="tx-cat">
                      {isTransfer ? (
                        <span className="cat-badge">
                          <ArrowLeftRight size={13} strokeWidth={1.6} className="ico" />
                          {acctMap[t.fromAccountId]?.name || '?'} → {acctMap[t.toAccountId]?.name || '?'}
                        </span>
                      ) : (
                        <span className="cat-badge">
                          <CategoryIcon name={t.category} size={13} />
                          {t.category}
                        </span>
                      )}
                      {t.projectId && projMap[t.projectId] && (
                        <span className="proj-badge"><i style={{ background: projMap[t.projectId].color }} />{projMap[t.projectId].name}</span>
                      )}
                    </td>
                    <td className="tx-type"><TypeBadge type={t.type} /></td>
                    <td className={`tx-amount ${t.type}`}>
                      {typeSignMap[t.type] || ''}{fmtCur(t.amount, t.currency)}
                      {isTransfer && t.toCurrency !== t.currency
                        ? <span className="fx-approx">→ {fmtCur(t.toAmount, t.toCurrency)}</span>
                        : <BaseApprox amount={t.amount} currency={t.currency} />}
                    </td>
                    <td className="tx-actions">
                      {!isTransfer && (
                        <button className="icon-btn edit-btn" onClick={() => setEditingTx(t)} title="Edit">
                          <Pencil size={13} strokeWidth={1.6} />
                        </button>
                      )}
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
        <TransactionModal
          onSave={addTransaction}
          onClose={() => setShowModal(false)}
          accounts={accounts} debts={debts} assets={assets} projects={projects}
          addTransfer={addTransfer} budgets={budgets}
        />
      )}
      {editingTx && (
        <TransactionModal
          existing={editingTx}
          onUpdate={updateTransaction}
          onClose={() => setEditingTx(null)}
          accounts={accounts} debts={debts} assets={assets} projects={projects}
          addTransfer={addTransfer} budgets={budgets}
        />
      )}
    </div>
  );
}
