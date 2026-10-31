import { cloneElement, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Download } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { usePreferences } from '../contexts/PreferencesContext';
import MonthPicker, { shiftMonth } from './MonthPicker';
import { CHART_THEME, DONUT_PALETTE, toDonutSlices } from '../chartTheme';
import { buildReport, customPeriod, fmtDay, isoDate, monthPeriod, quarterKey, quarterPeriod } from '../reports';

const KINDS = [['month', 'Month'], ['quarter', 'Quarter'], ['custom', 'Custom']];

const pctText = (c) => {
  if (c === null) return null;
  const pct = Math.round(Math.abs(c) * 100);
  return pct < 3 ? 'About the same' : `${c > 0 ? 'Up' : 'Down'} ${pct}%`;
};

function Comments({ items }) {
  if (!items.length) return null;
  return <ul className="report-comments">{items.map(c => <li key={c}>{c}</li>)}</ul>;
}

function Stat({ label, value, note }) {
  return <div className="report-stat"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

// Charts follow their container on screen. A print layout can't wait for that to resize, so they
// get the fixed size of the A4 page instead.
function Chart({ printing, width, height, children }) {
  if (printing) return cloneElement(children, { width, height });
  return <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>;
}

// Horizontal bars, drawn in plain HTML so they print exactly as shown. A row with a limit fills
// towards that limit (budget used); the rest are sized against the largest row.
function Bars({ rows }) {
  const max = Math.max(...rows.map(r => r.value), 0);
  const fill = (r) => { const of = r.limit || max; return of > 0 ? Math.min(r.value / of, 1) * 100 : 0; };
  return (
    <ul className="report-bars">
      {rows.map(r => (
        <li key={r.name}>
          <div className="report-bar-head"><span>{r.name}</span><em className={r.bad ? 'bad' : ''}>{r.note}</em></div>
          <div className="report-track">
            <div className={`report-fill ${r.bad ? 'bad' : ''}`} style={{ width: `${fill(r)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Reports({ transactions, allTransactions, budgets, accounts, debts, assets, lends, snapshots = [], missingRates = [], userName }) {
  const { prefs, fmt, fmtCur, baseCurrency } = usePreferences();
  const today     = isoDate(new Date());
  const thisMonth = today.slice(0, 7);
  const firstMonth = useMemo(() => allTransactions.reduce((min, t) => (t.date && t.date.slice(0, 7) < min ? t.date.slice(0, 7) : min), thisMonth), [allTransactions, thisMonth]);
  const monthsWithData = useMemo(() => new Set(allTransactions.map(t => t.date?.slice(0, 7)).filter(Boolean)), [allTransactions]);
  const quarters = useMemo(() => {
    const list = [];
    for (let m = thisMonth; m >= firstMonth; m = shiftMonth(m, -3)) list.push(quarterKey(m));
    if (!list.includes(quarterKey(firstMonth))) list.push(quarterKey(firstMonth));
    return list;
  }, [thisMonth, firstMonth]);

  const [kind,    setKind]    = useState('month');
  const [month,   setMonth]   = useState(thisMonth);
  const [quarter, setQuarter] = useState(quarterKey(thisMonth));
  const [from,    setFrom]    = useState(`${thisMonth}-01`);
  const [to,      setTo]      = useState(today);
  const [reveal,  setReveal]  = useState(false);
  const [printing, setPrinting] = useState(false);

  const badDates = kind === 'custom' && (!from || !to || from > to || from > today);
  const period = kind === 'quarter' ? quarterPeriod(quarter) : kind === 'custom' ? customPeriod(from, to) : monthPeriod(month);
  const report = badDates ? null : buildReport({ period, transactions, budgets, accounts, debts, assets, lends, snapshots, baseCurrency, fmt, fmtCur, today });

  // The saved PDF is always on white, whichever theme the app is in, and is named after the period
  const pageTitle = useRef(document.title);
  useEffect(() => {
    const before = () => {
      pageTitle.current = document.title;
      document.title = `MiAhorro report - ${period.short || period.label}`;
      flushSync(() => setPrinting(true));
    };
    const after = () => { document.title = pageTitle.current; setPrinting(false); };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, [period.short, period.label]);

  const themeAttr = document.documentElement.dataset.theme;
  const theme = printing ? 'light' : ['light', 'navy', 'sapphire'].includes(themeAttr) ? themeAttr : 'dark';
  const ct = CHART_THEME[theme];
  const compact = v => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  const controls = (
    <div className="report-controls">
      <div className="report-kinds" role="group" aria-label="Report period">
        {KINDS.map(([id, label]) => (
          <button key={id} type="button" className={kind === id ? 'active' : ''} aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>
        ))}
      </div>
      {kind === 'month' && <MonthPicker value={month} latest={thisMonth} earliest={firstMonth} withData={monthsWithData} onChange={setMonth} />}
      {kind === 'quarter' && (
        <select value={quarter} onChange={e => setQuarter(e.target.value)} aria-label="Quarter">
          {quarters.map(q => <option key={q} value={q}>{quarterPeriod(q).label}</option>)}
        </select>
      )}
      {kind === 'custom' && (
        <div className="report-dates">
          <input type="date" aria-label="From" value={from} max={today} onChange={e => setFrom(e.target.value)} />
          <span>to</span>
          <input type="date" aria-label="To" value={to} max={today} onChange={e => setTo(e.target.value)} />
        </div>
      )}
      {report && !report.empty && (!prefs.hideBalances || reveal) && (
        <button type="button" className="btn-secondary report-print" onClick={() => window.print()}>
          <Download size={14} strokeWidth={1.8} /> Save as PDF
        </button>
      )}
    </div>
  );

  const shell = (body) => (
    <div className="reports">
      <div className="page-header"><h2>Reports</h2></div>
      {controls}
      {body}
    </div>
  );

  if (badDates) return shell(<p className="report-notice">Choose a start date that's on or before the end date, and not in the future.</p>);
  if (prefs.hideBalances && !reveal) {
    return shell(
      <div className="chart-card report-empty">
        <p>Your balances are hidden, and a report is full of figures.</p>
        <button type="button" className="btn-secondary" onClick={() => setReveal(true)}>Show this report</button>
      </div>
    );
  }
  if (report.empty) return shell(<div className="chart-card report-empty"><p>No transactions recorded for {period.label}.</p></div>);

  const { totals, changes, comments, position, debt, budget, history } = report;
  const netWorthTrend = history.points.map(s => ({
    label: new Date(`${s.month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
    netWorth: s.netWorth,
  }));
  const projectCount = allTransactions.filter(t => t.projectId && t.date >= period.start && t.date <= report.end).length;
  const donut = toDonutSlices(report.categories.map(c => [c.name, c.value]), theme);
  const palette = DONUT_PALETTE[theme];
  const budgetRows = budget.rows.map(r => {
    const over = r.actual - r.budget;
    return {
      name: `${r.category}${r.type === 'expense' ? '' : r.type === 'income' ? ' (income)' : ' (savings)'}`,
      value: r.actual, limit: r.budget, bad: r.type === 'expense' && over > 0.005,
      note: `${fmt(r.actual)} of ${fmt(r.budget)}`,
    };
  });

  return shell(
    <article className="report">
      <header className="report-title">
        <p className="report-brand">MiAhorro Pocket · Financial report</p>
        <h1>{period.label}{report.partial ? ' so far' : ''}</h1>
        <p className="report-sub">
          {userName} · {fmtDay(period.start)} to {fmtDay(report.end)} · All amounts in {baseCurrency} · Generated {fmtDay(today)}
        </p>
      </header>

      {missingRates.length > 0 && (
        <p className="report-notice">Exchange rates are missing for {missingRates.join(', ')}, so amounts in those currencies may be left out of the totals.</p>
      )}
      {report.thin && (
        <p className="report-notice">Only {totals.count} transaction{totals.count === 1 ? ' is' : 's are'} recorded for this period, so comparisons and suggestions are left out.</p>
      )}

      <section className="chart-card report-section">
        <h2>Summary</h2>
        <div className="report-stats">
          <Stat label="Income" value={fmt(totals.income)} note={pctText(changes.income)} />
          <Stat label="Spending" value={fmt(totals.spending)} note={pctText(changes.spending)} />
          <Stat label="Saved & invested" value={fmt(totals.saved)} note={pctText(changes.saved)} />
          <Stat label="Left over" value={fmt(totals.left)} note={totals.savingsRate !== null ? `Savings rate ${Math.round(totals.savingsRate * 100)}%` : null} />
        </div>
        <Comments items={comments.summary} />
        {report.hasPrev && <p className="report-foot" style={{ padding: '10px 0 0' }}>Comparisons are with {report.compare.label}.</p>}
        <div className="report-chart" style={{ marginTop: 16 }}>
          <Chart printing={printing} width={640} height={240}>
            <BarChart data={report.trend} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={ct.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: ct.tick, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={8} />
              <YAxis tick={{ fill: ct.tick, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={compact} width={44} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="Income" fill={ct.income} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Spending" fill={palette[1]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </Chart>
        </div>
        {report.highlights.length > 0 && <><h3>Key events</h3><Comments items={report.highlights} /></>}
        {report.nextSteps.length > 0 && <><h3>Worth doing next</h3><Comments items={report.nextSteps} /></>}
      </section>

      {comments.income.length > 0 && (
        <section className="chart-card report-section">
          <h2>Income</h2>
          <Comments items={comments.income} />
          {report.incomeSources.length > 1 && (
            <Bars rows={report.incomeSources.map(s => ({ name: s.name, value: s.value, note: `${fmt(s.value)} · ${Math.round(s.share * 100)}%` }))} />
          )}
        </section>
      )}

      {totals.spending > 0 && (
        <section className="chart-card report-section">
          <h2>Spending</h2>
          <Comments items={comments.spending} />
          <div className="report-donut">
            <div className="report-chart">
              <Chart printing={printing} width={200} height={200}>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="95%" paddingAngle={1} stroke="none" isAnimationActive={false}>
                    {donut.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                </PieChart>
              </Chart>
            </div>
            <ul className="report-legend">
              {donut.map(s => (
                <li key={s.name}>
                  <i style={{ background: s.color }} />
                  <span>{s.name}</span>
                  <em>{Math.round((s.value / totals.spending) * 100)}%</em>
                  <span>{fmt(s.value)}</span>
                </li>
              ))}
            </ul>
          </div>
          <h3>Largest expenses</h3>
          <table className="report-table">
            <thead><tr><th>Date</th><th>Description</th><th className="report-hide-sm">Category</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {report.largest.map(t => (
                <tr key={t.id}><td>{fmtDay(t.date)}</td><td>{t.description}</td><td className="report-hide-sm">{t.category}</td><td className="num">{fmt(t.baseAmount)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {budget.rows.length > 0 ? (
        <section className="chart-card report-section">
          <h2>Budgets</h2>
          <Comments items={comments.budgets} />
          <Bars rows={budgetRows} />
        </section>
      ) : kind === 'custom' && budgets.length > 0 && budget.months.length === 0 && (
        <p className="report-notice">Budgets are monthly, so they appear when a period covers a whole calendar month.</p>
      )}

      {comments.debts.length > 0 && (
        <section className="chart-card report-section">
          <h2>Debts and loans</h2>
          <Comments items={comments.debts} />
          {debt.repayments.length > 1 && (
            <Bars rows={debt.repayments.map(d => ({ name: d.name, value: d.value, note: `${fmt(d.value)} · ${d.count} payment${d.count === 1 ? '' : 's'}` }))} />
          )}
        </section>
      )}

      <section className="chart-card report-section">
        <h2>Where you stand today</h2>
        <div className="report-stats" style={{ marginBottom: 0 }}>
          <Stat label="Net worth" value={fmt(position.netWorth)} />
          <Stat label="Cash" value={fmt(position.cash)} />
          <Stat label="Investments and money lent" value={fmt(position.investments + position.lent)} />
          <Stat label="Debts" value={fmt(position.debts)} />
        </div>
        {comments.position.length > 0 && <div style={{ marginTop: 16 }}><Comments items={comments.position} /></div>}
        <h3>Net worth over time</h3>
        {netWorthTrend.length < 2 ? (
          <p className="report-sub">Your app now saves your net worth each month, so this chart will appear once there are two months to show.</p>
        ) : (
          <div className="report-chart">
            <Chart printing={printing} width={640} height={240}>
              <AreaChart data={netWorthTrend} margin={{ top: 6, right: 18, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={ct.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: ct.tick, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={8} />
                <YAxis tick={{ fill: ct.tick, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={compact} width={44} domain={['auto', 'auto']} />
                <Area dataKey="netWorth" name="Net worth" stroke={ct.income} fill={ct.income} fillOpacity={0.15} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </AreaChart>
            </Chart>
          </div>
        )}
      </section>

      <p className="report-foot">
        The figures above the chart are today's balances, not balances at the end of the period. Money you hold for others isn't included.
        {netWorthTrend.length > 1 && ' Each month on the chart shows your position the last time the app was opened that month.'}
        {projectCount > 0 && ` ${projectCount} business project transaction${projectCount === 1 ? ' is' : 's are'} left out of this report.`}
        {' '}Income and spending match your Dashboard. Comments are generated from your records and aren't financial advice.
      </p>
    </article>
  );
}
