import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { EXPENSE_CATEGORIES, SAVINGS_CATEGORIES, getCategoryInfo } from '../hooks/useFinanceData';
import { fmt } from '../utils';
import CategoryIcon from './CategoryIcon';

const TOOLTIP_STYLE = {
  backgroundColor: '#101512',
  border: '1px solid #1e2b23',
  borderRadius: '10px',
  color: '#eaf5ef',
  fontSize: '13px',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="chart-tooltip">
      <p style={{ color: payload[0].payload.color, marginBottom: 4 }}>{payload[0].name}</p>
      <p><strong>{fmt(payload[0].value)}</strong></p>
    </div>
  );
};

export default function Dashboard({ transactions, budgets }) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── Current-month stats ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const txs = transactions.filter(t => t.date.startsWith(currentMonth));
    const income  = txs.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0);
    const expenses= txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const saved   = txs.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0);
    const cash    = income - expenses - saved;   // what's left in pocket
    return { income, expenses, saved, cash };
  }, [transactions, currentMonth]);

  // ── Expense breakdown (donut) ──────────────────────────────────────────
  const expenseCategoryData = useMemo(() => {
    const acc = {};
    transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
      .forEach(t => { acc[t.category] = (acc[t.category] || 0) + t.amount; });
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value, color: getCategoryInfo(name).color }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, currentMonth]);

  // ── Savings breakdown (donut) ──────────────────────────────────────────
  const savingsCategoryData = useMemo(() => {
    const acc = {};
    transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'savings')
      .forEach(t => { acc[t.category] = (acc[t.category] || 0) + t.amount; });
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value, color: getCategoryInfo(name).color }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, currentMonth]);

  // ── Monthly trend (area chart) – last 6 months ─────────────────────────
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const txs = transactions.filter(t => t.date.startsWith(m));
      return {
        month:    d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Income:   txs.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0),
        Expenses: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        Savings:  txs.filter(t => t.type === 'savings').reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [transactions]);

  // ── Budget vs actual ──────────────────────────────────────────────────
  const budgetComparison = useMemo(() => {
    return budgets.filter(b => b.month === currentMonth).map(b => {
      const spent = transactions
        .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense' && t.category === b.category)
        .reduce((s, t) => s + t.amount, 0);
      return { name: b.category.split(' & ')[0].split(' ')[0], budget: b.amount, spent };
    });
  }, [transactions, budgets, currentMonth]);

  // ── Recent 6 transactions ─────────────────────────────────────────────
  const recentTransactions = useMemo(() =>
    [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    [transactions]
  );

  const statCards = [
    { label: 'Monthly Income',     value: fmt(stats.income),   cls: 'income',      sub: 'All sources this month' },
    { label: 'Monthly Expenses',   value: fmt(stats.expenses), cls: 'expense',     sub: 'Total spent this month' },
    { label: 'Saved & Invested',   value: fmt(stats.saved),    cls: 'saved',       sub: 'Savings + investments' },
    { label: 'Cash Balance',       value: fmt(stats.cash),     cls: stats.cash >= 0 ? 'balance-pos' : 'balance-neg', sub: stats.cash >= 0 ? 'Available cash' : 'Overspent!' },
  ];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <span className="month-badge">
          {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        {statCards.map(card => (
          <div key={card.label} className={`stat-card ${card.cls}`}>
            <span className="stat-label">{card.label}</span>
            <span className="stat-value">{card.value}</span>
            <span className="stat-sub">{card.sub}</span>
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
              <Tooltip content={<CustomTooltip />} />
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
                    dataKey="value" paddingAngle={3}>
                    {expenseCategoryData.map((e, i) => <Cell key={i} fill={e.color} stroke="#101512" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {expenseCategoryData.slice(0, 5).map(d => (
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
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetComparison} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2b23" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#7aaa8c', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7aaa8c', fontSize: 12 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#7aaa8c', fontSize: '13px', paddingTop: '8px' }} />
                <Bar dataKey="budget" name="Budget" fill="#1e3828" radius={[6,6,0,0]} maxBarSize={40} />
                <Bar dataKey="spent"  name="Spent"  fill="#00a854" radius={[6,6,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
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
                    dataKey="value" paddingAngle={3}>
                    {savingsCategoryData.map((e, i) => <Cell key={i} fill={e.color} stroke="#101512" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
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
            const cat = getCategoryInfo(t.category);
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
                  {t.type === 'income' ? '+' : t.type === 'savings' ? '→ ' : '-'}{fmt(t.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
