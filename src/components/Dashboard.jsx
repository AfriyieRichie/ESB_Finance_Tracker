import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, Rectangle, Sector,
} from 'recharts';
import { usePreferences } from '../contexts/PreferencesContext';
import CategoryIcon from './CategoryIcon';

const TOOLTIP_STYLE = {
  backgroundColor: '#101512',
  border: '1px solid #1e2b23',
  borderRadius: '10px',
  color: '#eaf5ef',
  fontSize: '13px',
};

// Categorical palette for donut charts: distinct hues in a fixed order, validated for colour-blind
// separation against each theme's card surface. Past 7 categories the smallest fold into "Other"
// (neutral grey) rather than reusing a colour.
const DONUT_PALETTE = {
  dark:  ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'],
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'],
};
const OTHER_COLOR  = { dark: '#6b7a71', light: '#9aa59f' };
const CARD_SURFACE = { dark: '#101512', light: '#ffffff' };   // 2px gap between segments

// [name, value] pairs → largest-first slices with colours; folds the tail into "Other" past 7
function toDonutSlices(entries, theme) {
  const palette = DONUT_PALETTE[theme];
  const sorted  = entries.sort((a, b) => b[1] - a[1]);
  const shown   = sorted.length > palette.length ? sorted.slice(0, palette.length - 1) : sorted;
  const rest    = sorted.slice(shown.length).reduce((sum, [, v]) => sum + v, 0);
  const slices  = shown.map(([name, value], i) => ({ name, value, color: palette[i] }));
  if (rest > 0) slices.push({ name: 'Other', value: rest, color: OTHER_COLOR[theme] });
  return slices;
}

// Hovered bar "pops out": slightly wider and taller, brighter, with a soft outline
const PopBar = ({ x, y, width, height, fill, highlight }) => (
  <Rectangle x={x - 3} y={y - 4} width={width + 6} height={height + 4}
    radius={[7, 7, 0, 0]} fill={highlight || fill}
    stroke="rgba(234,245,239,0.35)" strokeWidth={1} />
);

// Hovered/tapped donut slice "pops out": a few px further out, same colour
const PopSlice = (props) => <Sector {...props} outerRadius={props.outerRadius + 6} />;

// Series whose bar colour is too dark to read as text in the tooltip
const TOOLTIP_TEXT_COLOR = { Budget: '#9cc7ad' };

const CustomTooltip = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: TOOLTIP_TEXT_COLOR[p.name] || p.color, margin: '2px 0' }}>
          {p.name}: <strong>{fmt ? fmt(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="chart-tooltip">
      <p style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span className="pie-dot" style={{ background: payload[0].payload.color }} />
        {payload[0].name}
      </p>
      <p><strong>{fmt ? fmt(payload[0].value) : payload[0].value}</strong></p>
    </div>
  );
};

// All totals here use base-currency values (baseAmount / baseBalance / baseValue) computed in App
export default function Dashboard({ transactions, budgets, accounts, debts, assets, missingRates = [] }) {
  const { prefs, fmt, fmtCur, baseCurrency, rateFor, ratesDate } = usePreferences();
  // Effective theme ('system' is already resolved onto <html data-theme>)
  const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  const hidden = prefs.hideBalances;
  const mask   = '••••••';

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── Account-derived balances (ground truth) ────────────────────────────
  const totalCash        = accounts.reduce((s, a) => s + (a.baseBalance || 0), 0);
  const totalInvestments = (assets  || []).filter(a => a.status === 'active').reduce((s, a) => s + (a.baseValue || 0), 0);
  const totalDebts       = (debts   || []).filter(d => d.status !== 'paid').reduce((s, d) => s + (d.baseBalance || 0), 0);
  const netWorth         = totalCash + totalInvestments - totalDebts;

  // Cash per currency (base first) for the multi-currency breakdown
  const cashByCurrency = Object.entries(
    accounts.reduce((m, a) => ({ ...m, [a.currency]: (m[a.currency] || 0) + (a.balance || 0) }), {})
  ).sort(([a], [b]) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : a.localeCompare(b)));
  const foreignCurrencies = cashByCurrency.map(([c]) => c).filter(c => c !== baseCurrency);

  // ── Current-month stats ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const txs      = transactions.filter(t => t.date.startsWith(currentMonth));
    const income   = txs.filter(t => t.type === 'income').reduce((s, t)  => s + t.baseAmount, 0);
    const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.baseAmount, 0);
    const saved    = txs.filter(t => t.type === 'savings').reduce((s, t) => s + t.baseAmount, 0);
    const expensePct = income > 0 ? Math.round((expenses / income) * 100) : null;
    const savedPct   = income > 0 ? Math.round((saved   / income) * 100) : null;
    return { income, expenses, saved, expensePct, savedPct };
  }, [transactions, currentMonth]);

  // ── Expense breakdown (donut) ──────────────────────────────────────────
  const expenseCategoryData = useMemo(() => {
    const acc = {};
    transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
      .forEach(t => { acc[t.category] = (acc[t.category] || 0) + t.baseAmount; });
    return toDonutSlices(Object.entries(acc), theme);
  }, [transactions, currentMonth, theme]);

  // ── Savings breakdown (donut) ──────────────────────────────────────────
  const savingsCategoryData = useMemo(() => {
    const acc = {};
    transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'savings')
      .forEach(t => { acc[t.category] = (acc[t.category] || 0) + t.baseAmount; });
    return toDonutSlices(Object.entries(acc), theme);
  }, [transactions, currentMonth, theme]);

  // ── Monthly trend (area chart) – last 6 months ─────────────────────────
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const txs = transactions.filter(t => t.date.startsWith(m));
      return {
        month:    d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Income:   txs.filter(t => t.type === 'income').reduce((s, t)  => s + t.baseAmount, 0),
        Expenses: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.baseAmount, 0),
        Savings:  txs.filter(t => t.type === 'savings').reduce((s, t) => s + t.baseAmount, 0),
      };
    });
  }, [transactions]);

  // ── Budget vs actual ──────────────────────────────────────────────────
  const budgetComparison = useMemo(() => {
    return budgets.filter(b => b.month === currentMonth).map(b => {
      const txType = b.type || 'expense';
      const spent = transactions
        .filter(t => t.date.startsWith(currentMonth) && t.type === txType && t.category === b.category)
        .reduce((s, t) => s + t.baseAmount, 0);
      // Short label: first word only, max 8 chars
      const label = b.category.split(' & ')[0].split(' ')[0].slice(0, 8);
      return { name: label, budget: b.amount, spent };
    });
  }, [transactions, budgets, currentMonth]);

  // ── Recent 6 transactions ─────────────────────────────────────────────
  const recentTransactions = useMemo(() =>
    [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    [transactions]
  );

  const statCards = [
    { label: 'Monthly Income',   value: hidden ? mask : fmt(stats.income),   cls: 'income',  sub: 'All sources this month' },
    { label: 'Monthly Expenses', value: hidden ? mask : fmt(stats.expenses), cls: 'expense', sub: 'Total spent this month',  pct: stats.expensePct, pctCls: 'pct-expense' },
    { label: 'Saved & Invested', value: hidden ? mask : fmt(stats.saved),    cls: 'saved',   sub: 'Savings + investments',   pct: stats.savedPct,   pctCls: 'pct-saved'   },
    {
      label:    'Cash Balance',
      value:    hidden ? mask : fmt(totalCash),
      cls:      totalCash >= 0 ? 'balance-pos' : 'balance-neg',
      sub:      totalCash >= 0 ? 'Across all accounts' : 'Negative balance!',
      netWorth: hidden ? mask : fmt(netWorth),
      nwCls:    netWorth >= 0 ? 'nw-pos' : 'nw-neg',
    },
  ];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <span className="month-badge">
          {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {missingRates.length > 0 && (
        <p className="fx-warning">
          No exchange rate available for {missingRates.join(', ')}. Those amounts are left out of the totals.
          Set a rate in Settings → Exchange Rates.
        </p>
      )}

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        {statCards.map(card => (
          <div key={card.label} className={`stat-card ${card.cls}`}>
            <span className="stat-label">{card.label}</span>
            <span className="stat-value">{card.value}</span>
            {card.netWorth !== undefined && (
              <div className={`stat-net-worth ${card.nwCls}`}>
                <span className="stat-nw-label">Net Worth</span>
                <span className="stat-nw-value">{card.netWorth}</span>
              </div>
            )}
            {card.netWorth !== undefined && foreignCurrencies.length > 0 && (
              <div className="fx-breakdown fx-breakdown--card">
                {cashByCurrency.map(([cur, amt]) => (
                  <span key={cur} className="fx-chip">{hidden ? mask : fmtCur(amt, cur)}</span>
                ))}
                {foreignCurrencies.map(cur => rateFor(cur) && (
                  <span key={`r-${cur}`} className="fx-rate">
                    {rateFor(cur) >= 1
                      ? `1 ${baseCurrency} = ${rateFor(cur).toFixed(2)} ${cur}`
                      : `1 ${cur} = ${(1 / rateFor(cur)).toFixed(2)} ${baseCurrency}`}
                    {ratesDate ? ` · ${ratesDate}` : ''}
                  </span>
                ))}
              </div>
            )}
            <div className="stat-footer">
              <span className="stat-sub">{card.sub}</span>
              {card.pct !== null && card.pct !== undefined && (
                <span className={`stat-pct-badge ${card.pctCls}`}>{card.pct}% of income</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 1: Area trend + Expense donut ── */}
      <div className="chart-row">
        <div className="chart-card span-2">
          <div className="chart-header">
            <h3>Income · Expenses · Savings</h3>
            <span className="chart-badge">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gIncome"  x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00a854" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#00a854" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f04545" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#f04545" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSavings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2b23" strokeOpacity={0.4} />
              <XAxis dataKey="month" tick={{ fill: '#7aaa8c', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#7aaa8c', fontSize: 12 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} />
              <Tooltip content={props => <CustomTooltip {...props} fmt={fmt} />} />
              <Legend wrapperStyle={{ color: '#7aaa8c', fontSize: '13px', paddingTop: '8px' }} />
              <Area type="monotone" dataKey="Income"   stroke="#00a854" fill="url(#gIncome)"  strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#00a854', strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Expenses" stroke="#f04545" fill="url(#gExpense)" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#f04545', strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Savings"  stroke="#06b6d4" fill="url(#gSavings)" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#06b6d4', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Spending by Category</h3>
            <span className="chart-badge">This month</span>
          </div>
          {expenseCategoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={expenseCategoryData} cx="50%" cy="50%" innerRadius={52} outerRadius={78}
                    dataKey="value" paddingAngle={3} activeShape={PopSlice}>
                    {expenseCategoryData.map((e, i) => <Cell key={i} fill={e.color} stroke={CARD_SURFACE[theme]} strokeWidth={2} />)}
                  </Pie>
                  <Tooltip content={props => <PieTooltip {...props} fmt={fmt} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {expenseCategoryData.map(d => (
                  <div key={d.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: d.color }} />
                    <span className="pie-name">{d.name}</span>
                    <span className="pie-val">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="empty-state-sm">No expenses this month yet</div>}
        </div>
      </div>

      {/* ── Row 2: Budget vs Actual + Savings breakdown ── */}
      <div className="chart-row">
        <div className="chart-card span-2">
          <div className="chart-header">
            <h3>Budget vs Actual</h3>
            <span className="chart-badge">This month</span>
          </div>
          {budgetComparison.length > 0 ? (
            <div className="budget-chart-scroll">
              {/* Fills the card; scrolls inside it when there are too many budgets to fit */}
              <div style={{ minWidth: budgetComparison.length * 64 }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={budgetComparison} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2b23" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#7aaa8c', fontSize: 11 }} axisLine={false} tickLine={false}
                    angle={-35} textAnchor="end" interval={0} height={50} />
                  <YAxis tick={{ fill: '#7aaa8c', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${v/1000}k` : `${v}`} width={36} />
                  <Tooltip cursor={false} content={props => <CustomTooltip {...props} fmt={fmt} />} />
                  <Legend wrapperStyle={{ color: '#7aaa8c', fontSize: '12px', paddingTop: '4px' }} />
                  <Bar dataKey="budget" name="Budget" fill="#1e3828" radius={[6,6,0,0]} maxBarSize={36}
                    activeBar={props => <PopBar {...props} highlight="#2c5a3e" />} />
                  <Bar dataKey="spent"  name="Spent"  fill="#00a854" radius={[6,6,0,0]} maxBarSize={36}
                    activeBar={props => <PopBar {...props} highlight="#00e676" />} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          ) : <div className="empty-state-sm">No budgets set for this month</div>}
        </div>

        {/* Savings & Investments breakdown */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Savings & Investments</h3>
            <span className="chart-badge">This month</span>
          </div>
          {savingsCategoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={savingsCategoryData} cx="50%" cy="50%" innerRadius={52} outerRadius={78}
                    dataKey="value" paddingAngle={3} activeShape={PopSlice}>
                    {savingsCategoryData.map((e, i) => <Cell key={i} fill={e.color} stroke={CARD_SURFACE[theme]} strokeWidth={2} />)}
                  </Pie>
                  <Tooltip content={props => <PieTooltip {...props} fmt={fmt} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {savingsCategoryData.map(d => (
                  <div key={d.name} className="pie-legend-item">
                    <span className="pie-dot" style={{ background: d.color }} />
                    <span className="pie-name">{d.name}</span>
                    <span className="pie-val">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="empty-state-sm">No savings recorded this month</div>}
        </div>
      </div>

      {/* ── Row 3: Recent Transactions (full width) ── */}
      <div className="chart-card">
        <div className="chart-header">
          <h3>Recent Transactions</h3>
          <span className="chart-badge">Latest activity</span>
        </div>
        <div className="recent-list recent-list--horizontal">
          {recentTransactions.map(t => {
            return (
              <div key={t.id} className="recent-item">
                <span className="recent-icon">
                  <CategoryIcon name={t.category} size={16} />
                </span>
                <div className="recent-info">
                  <span className="recent-desc">{t.description}</span>
                  <span className="recent-date">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' · '}{t.category}
                  </span>
                </div>
                <span className={`recent-amount ${t.type}`}>
                  {t.type === 'income' ? '+' : t.type === 'savings' ? '→ ' : '-'}{fmtCur(t.amount, t.currency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
