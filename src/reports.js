// Personal finance reports: picks a period, works out its figures and writes the commentary.
// Pure functions over the data App already prepares (baseAmount / baseBalance / baseValue), so a
// report's totals always match the Dashboard. Pass personal transactions only (no projects).

const MIN_TX = 5;   // below this, a period is too thin for comparisons and advice

// Advice stays away from categories that aren't really choices, and never suggests cutting giving.
// Default category names; categories a user adds simply aren't picked up by the flexible rule.
const FLEXIBLE    = ['Entertainment', 'Shopping', 'Personal Care'];
const NOT_TRIMMED = ['Debt Repayment', 'Tithe & Giving', 'Healthcare', 'Education'];
const FIXED_BILLS = ['Housing', 'Utilities', ...NOT_TRIMMED];

const pad = n => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse     = (s) => new Date(`${s}T00:00:00`);
const addDays   = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return isoDate(d); };
const dayCount  = (a, b) => Math.round((parse(b) - parse(a)) / 86400000) + 1;
const minDate   = (a, b) => (a < b ? a : b);
const monthName = (s, opts = { month: 'long', year: 'numeric' }) => parse(s).toLocaleDateString('en-GB', opts);
export const fmtDay = (s) => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const total  = (list) => list.reduce((s, t) => s + (t.baseAmount || 0), 0);
const quoted = (t) => `"${t.description || t.category}"`;
const listOf = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

// ── Periods ──────────────────────────────────────────────────────────────

export function monthPeriod(ym) {
  const [y, m] = ym.split('-').map(Number);
  const start = isoDate(new Date(y, m - 1, 1));
  return { kind: 'month', start, end: isoDate(new Date(y, m, 0)), label: monthName(start) };
}

export function quarterPeriod(key) {
  const [y, q] = key.split('-Q').map(Number);
  const start = isoDate(new Date(y, (q - 1) * 3, 1));
  const end   = isoDate(new Date(y, q * 3, 0));
  const span  = `${monthName(start, { month: 'short' })}–${monthName(end, { month: 'short' })}`;
  return { kind: 'quarter', start, end, label: `Q${q} ${y} (${span})`, short: `Q${q} ${y}` };
}

export const customPeriod = (start, end) =>
  ({ kind: 'custom', start, end, label: start === end ? fmtDay(start) : `${fmtDay(start)} – ${fmtDay(end)}` });

export const quarterKey = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
};

// What to compare with. An unfinished period is compared with the same point in the last one, so
// three weeks of spending isn't set against a full month.
function comparisonFor(period, end, partial) {
  const elapsed = dayCount(period.start, end);
  if (period.kind === 'custom') {
    return { start: addDays(period.start, -elapsed), end: addDays(period.start, -1), label: `the previous ${plural(elapsed, 'day')}` };
  }
  const [y, m] = period.start.split('-').map(Number);
  const prev = period.kind === 'month'
    ? monthPeriod(isoDate(new Date(y, m - 2, 1)).slice(0, 7))
    : quarterPeriod(quarterKey(isoDate(new Date(y, m - 4, 1)).slice(0, 7)));
  const name = prev.short || prev.label;
  return {
    start: prev.start,
    end: minDate(addDays(prev.start, elapsed - 1), prev.end),
    label: partial ? `the same point in ${name}` : name,
  };
}

// ── Figures ──────────────────────────────────────────────────────────────

function rollUp(list) {
  const groups = {};
  list.forEach(t => {
    const name = t.category || 'Other';
    (groups[name] ||= { name, value: 0, items: [] }).value += t.baseAmount || 0;
    groups[name].items.push(t);
  });
  return Object.values(groups).sort((a, b) => b.value - a.value);
}

function summarise(txs) {
  const income   = txs.filter(t => t.type === 'income');
  const expenses = txs.filter(t => t.type === 'expense');
  const savings  = txs.filter(t => t.type === 'savings');
  return {
    count: txs.length, income, expenses, savings,
    incomeTotal: total(income), spending: total(expenses), saved: total(savings),
    debtRepaid: total(expenses.filter(t => t.debtId)),
  };
}

// Income vs spending over the period: weekly for short periods, monthly for longer ones
function trendFor(txs, start, end) {
  const buckets = [];
  if (dayCount(start, end) <= 62) {
    for (let from = start; from <= end; from = addDays(from, 7)) {
      buckets.push({ label: parse(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), from, to: minDate(addDays(from, 6), end) });
    }
  } else {
    for (let from = start; from <= end;) {
      const d = parse(from);
      const next = isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
      buckets.push({ label: monthName(from, { month: 'short', year: '2-digit' }), from, to: minDate(addDays(next, -1), end) });
      from = next;
    }
  }
  return buckets.map(({ label, from, to }) => {
    const part = txs.filter(t => t.date >= from && t.date <= to);
    return { label, Income: total(part.filter(t => t.type === 'income')), Spending: total(part.filter(t => t.type === 'expense')) };
  });
}

// Budgets are monthly, so only months wholly inside the period can be compared fairly
function budgetsFor(period, budgets, transactions, end) {
  const months = [];
  for (let m = monthPeriod(period.start.slice(0, 7)); m.start <= period.end; m = monthPeriod(addDays(m.end, 1).slice(0, 7))) {
    if (m.start >= period.start && m.end <= period.end) months.push(m.start.slice(0, 7));
  }
  const rows = {};
  budgets.filter(b => months.includes(b.month)).forEach(b => {
    const type = b.type || 'expense';
    const key  = `${type}|${b.category}`;
    (rows[key] ||= { type, category: b.category, budget: 0, actual: 0 }).budget += b.amount || 0;
  });
  Object.values(rows).forEach(r => {
    r.actual = total(transactions.filter(t => t.type === r.type && t.category === r.category
      && t.date <= end && months.includes(t.date.slice(0, 7))));
  });
  return { rows: Object.values(rows).sort((a, b) => b.budget - a.budget), months };
}

function debtsFor(period, end, txs, debts) {
  const nameOf = (id) => debts.find(d => d.id === id)?.name || 'A debt no longer listed';
  const repaid = {};
  txs.filter(t => t.debtId && t.type !== 'transfer').forEach(t => {
    const name = nameOf(t.debtId);
    (repaid[name] ||= { name, value: 0, count: 0 }).value += t.baseAmount || 0;
    repaid[name].count += 1;
  });
  const borrowed = txs.filter(t => t.type === 'loan')
    .map(t => ({ name: nameOf(t.loanDebtId), value: t.baseAmount || 0 }));
  const cleared = debts.filter(d => d.paidOffDate && d.paidOffDate >= period.start && d.paidOffDate <= end);
  const open = debts.filter(d => d.status !== 'paid' && (d.baseBalance || 0) > 0.005);
  return {
    repayments: Object.values(repaid).sort((a, b) => b.value - a.value),
    borrowed, cleared, open,
    owedToday: open.reduce((s, d) => s + (d.baseBalance || 0), 0),
  };
}

// Same payee, similar amount, in at least 3 of the last 6 months, about once a month
function regularPayments(transactions, cur, end) {
  const since = addDays(end, -183);
  const seen = {};
  transactions.filter(t => t.type === 'expense' && !t.debtId && !FIXED_BILLS.includes(t.category)
    && t.date >= since && t.date <= end && t.description).forEach(t => {
    (seen[t.description.trim().toLowerCase()] ||= []).push(t);
  });
  const inPeriod = new Set(cur.expenses.map(t => t.description?.trim().toLowerCase()));
  return Object.entries(seen).filter(([key]) => inPeriod.has(key)).flatMap(([, list]) => {
    const months  = new Set(list.map(t => t.date.slice(0, 7))).size;
    const amounts = list.map(t => t.baseAmount || 0);
    const similar = Math.max(...amounts) <= Math.min(...amounts) * 1.25;
    if (months < 3 || list.length > months + 1 || !similar) return [];
    return [{ name: list[0].description, yearly: (total(list) / list.length) * 12 }];
  }).sort((a, b) => b.yearly - a.yearly);
}

// Monthly average per category across the 3 months before `start`, if at least 2 have records
function threeMonthAverages(transactions, start) {
  const [y, m] = start.split('-').map(Number);
  const months = [1, 2, 3].map(back => isoDate(new Date(y, m - 1 - back, 1)).slice(0, 7));
  const past = transactions.filter(t => t.type === 'expense' && months.includes(t.date.slice(0, 7)));
  if (new Set(past.map(t => t.date.slice(0, 7))).size < 2) return null;
  return Object.fromEntries(rollUp(past).map(c => [c.name, c.value / 3]));
}

function savingsFor(period, end, today, cur, assets) {
  const held = assets.filter(a => a.status === 'active' && !a.heldForOthers).map(a => {
    const rate = a.currentValue > 0 ? (a.baseValue || 0) / a.currentValue : 0;
    const cost = (a.costBasis || 0) * rate;
    return { id: a.id, name: a.name, value: a.baseValue || 0, cost, gain: (a.baseValue || 0) - cost };
  }).sort((a, b) => b.value - a.value);
  const soon = addDays(today, 60);
  return {
    byCategory: rollUp(cur.savings),
    held,
    value: held.reduce((s, a) => s + a.value, 0),
    cost:  held.reduce((s, a) => s + a.cost, 0),
    cashedOut: assets.filter(a => a.cashedOutDate >= period.start && a.cashedOutDate <= end),
    maturing: assets.filter(a => a.status === 'active' && /^\d{4}-\d{2}-\d{2}$/.test(a.maturityDate || '')
      && a.maturityDate >= today && a.maturityDate <= soon),
  };
}

// Today's position. Money held for others is left out, as on the Dashboard.
export function netPosition({ accounts, assets, lends, debts }) {
  const cash        = accounts.filter(a => !a.heldForOthers).reduce((s, a) => s + (a.baseBalance || 0), 0);
  const investments = assets.filter(a => a.status === 'active' && !a.heldForOthers).reduce((s, a) => s + (a.baseValue || 0), 0);
  const lent        = lends.reduce((s, l) => s + (l.baseOwed || 0), 0);
  const owed        = debts.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.baseBalance || 0), 0);
  return { cash, investments, lent, debts: owed, netWorth: cash + investments + lent - owed };
}

// Saved month-end positions up to the period's end, plus the movement across the period if both
// ends were saved. Figures saved in another base currency can't be compared, so they're skipped.
function historyFor(period, end, snapshots, baseCurrency) {
  const usable = snapshots.filter(s => s.baseCurrency === baseCurrency && s.date <= end)
    .sort((a, b) => a.month.localeCompare(b.month));
  const before = addDays(period.start, -1).slice(0, 7);
  const opening = period.start.endsWith('-01') ? usable.find(s => s.month === before) : null;
  const closing = usable.find(s => s.month === end.slice(0, 7));
  return { points: usable.slice(-12), opening, closing };
}

// ── The report ───────────────────────────────────────────────────────────

export function buildReport({ period, transactions, budgets, accounts, debts, assets, lends, snapshots = [], baseCurrency, fmt, fmtCur, today }) {
  const partial = period.end > today;
  const end     = minDate(period.end, today);
  const compare = comparisonFor(period, end, partial);
  const within  = (a, b) => transactions.filter(t => t.date >= a && t.date <= b);
  const txs     = within(period.start, end);
  const cur     = summarise(txs);
  const prev    = summarise(within(compare.start, compare.end));
  const hasPrev = prev.count >= MIN_TX;
  const thin    = cur.count < MIN_TX;
  const days    = dayCount(period.start, end);
  const { incomeTotal: income, spending, saved, debtRepaid } = cur;

  const left        = income - spending - saved;
  const savingsRate = income > 0 ? saved / income : null;

  const change = (now, then) => (hasPrev && then > 0 ? (now - then) / then : null);
  // ", up 12% on September 2026 (£ 900.00)"
  const against = (now, then) => {
    const c = change(now, then);
    if (c === null) return '';
    const pct = Math.round(Math.abs(c) * 100);
    if (pct < 3) return `, about the same as ${compare.label}`;
    return `, ${c > 0 ? 'up' : 'down'} ${pct}% on ${compare.label} (${fmt(then)})`;
  };

  // ── Categories and sources ─────────────────────────────────────────────
  const prevCats = Object.fromEntries(rollUp(prev.expenses).map(c => [c.name, c.value]));
  const categories = rollUp(cur.expenses).map(c => ({
    ...c, share: spending > 0 ? c.value / spending : 0,
    prev: prevCats[c.name] || 0, change: change(c.value, prevCats[c.name] || 0),
  }));
  const incomeSources = rollUp(cur.income).map(c => ({ ...c, share: income > 0 ? c.value / income : 0 }));
  // Repaying a debt is progress, not spending to cut, so it's left out of the advice
  const dayToDay = categories.filter(c => !c.items.every(t => t.debtId));
  const largest = [...cur.expenses].sort((a, b) => (b.baseAmount || 0) - (a.baseAmount || 0)).slice(0, 5);

  const budget = budgetsFor(period, budgets, transactions, end);
  const debt   = debtsFor(period, end, txs, debts);

  const position = netPosition({ accounts, assets, lends, debts });
  const history  = historyFor(period, end, snapshots, baseCurrency);
  const savings  = savingsFor(period, end, today, cur, assets);

  // ── Commentary ─────────────────────────────────────────────────────────
  const soFar = partial ? ' so far' : '';
  const comments = { summary: [], income: [], spending: [], advice: [], savings: [], budgets: [], debts: [], position: [] };

  if (income > 0 && spending > income) {
    comments.summary.push(`You spent ${fmt(spending - income)} more than you received${soFar}, so the gap came from existing balances or borrowing.`);
  } else if (income > 0) {
    const pct = Math.round((spending / income) * 100);
    comments.summary.push(`You spent ${pct}% of your income${soFar}, leaving ${fmt(income - spending)} before savings.`);
  }
  if (savingsRate !== null && saved > 0) {
    comments.summary.push(`You put ${fmt(saved)} into savings and investments, ${Math.round(savingsRate * 100)}% of your income${against(saved, prev.saved)}.`);
  } else if (income > 0) {
    comments.summary.push('You recorded no savings or investments in this period.');
  }

  if (income > 0) {
    comments.income.push(`You received ${fmt(income)}${against(income, prev.incomeTotal)}.`);
    const top = incomeSources[0];
    if (incomeSources.length > 1) {
      comments.income.push(`${top.name} was your largest source at ${Math.round(top.share * 100)}% of the total, across ${plural(incomeSources.length, 'source')}.`);
    }
    if (!thin && incomeSources.length === 1) {
      comments.income.push(`All of it came from ${top.name}, so this period relied on a single source.`);
    }
    const biggest = [...cur.income].sort((a, b) => b.baseAmount - a.baseAmount)[0];
    const cashOuts = total(cur.income.filter(t => t.assetId));
    if (cashOuts > 0) comments.income.push(`This includes ${fmt(cashOuts)} from cashing out investments, much of which is your own money coming back rather than new income.`);
    if (cur.income.length > 1) comments.income.push(`The largest payment was ${quoted(biggest)} at ${fmt(biggest.baseAmount)} on ${fmtDay(biggest.date)}.`);
  } else if (cur.count > 0) {
    comments.income.push('No income was recorded in this period.');
  }

  if (spending > 0) {
    comments.spending.push(`You spent ${fmt(spending)}${against(spending, prev.spending)}, about ${fmt(spending / days)} a day.`);
    if (debtRepaid > 0) {
      comments.spending.push(`${fmt(debtRepaid)} of that went on debt repayments, leaving ${fmt(spending - debtRepaid)} of other spending${against(spending - debtRepaid, prev.spending - prev.debtRepaid)}.`);
    }
    const top = categories[0];
    comments.spending.push(`${top.name} was your largest category at ${fmt(top.value)}, ${Math.round(top.share * 100)}% of the total.`);

    if (!thin) {
      const notable = Math.max(spending * 0.03, 1);
      const moved = categories.filter(c => c.change !== null && Math.abs(c.change) >= 0.2 && Math.abs(c.value - c.prev) >= notable);
      const rises = moved.filter(c => c.change > 0).sort((a, b) => (b.value - b.prev) - (a.value - a.prev)).slice(0, 2);
      const falls = moved.filter(c => c.change < 0).sort((a, b) => (a.value - a.prev) - (b.value - b.prev)).slice(0, 2);
      rises.forEach(c => {
        const big = [...c.items].sort((a, b) => b.baseAmount - a.baseAmount)[0];
        comments.spending.push(`${c.name} rose ${Math.round(c.change * 100)}% to ${fmt(c.value)} from ${fmt(c.prev)}. The largest item was ${quoted(big)} at ${fmt(big.baseAmount)}.`);
      });
      if (falls.length) {
        comments.spending.push(`Spending fell on ${listOf(falls.map(c => `${c.name} (down ${Math.round(-c.change * 100)}% to ${fmt(c.value)})`))}.`);
      }
      if (hasPrev) {
        const fresh = dayToDay.filter(c => !c.prev && c.share >= 0.05).slice(0, 2);
        if (fresh.length) comments.spending.push(`New compared with ${compare.label}: ${listOf(fresh.map(c => `${c.name} (${fmt(c.value)})`))}.`);
      }
    }
    if (cur.expenses.length > 1) {
      const big = largest[0];
      const share = Math.round((big.baseAmount / spending) * 100);
      comments.spending.push(`Your largest single expense was ${quoted(big)} at ${fmt(big.baseAmount)} on ${fmtDay(big.date)}${share >= 15 ? `, ${share}% of all spending` : ''}.`);
    }
  }

  // ── Spending advice ────────────────────────────────────────────────────
  if (!thin && spending > 0) {
    const notable  = Math.max(spending * 0.03, 1);
    const yearly   = 365 / days;
    const averages = period.kind === 'month' && !partial ? threeMonthAverages(transactions, period.start) : null;
    if (averages) {
      categories.filter(c => !NOT_TRIMMED.includes(c.name) && !c.items.every(t => t.debtId)
        && averages[c.name] > 0 && c.value >= averages[c.name] * 1.25 && c.value - averages[c.name] >= notable)
        .sort((a, b) => (b.value - averages[b.name]) - (a.value - averages[a.name])).slice(0, 2)
        .forEach(c => {
          const avg = averages[c.name];
          comments.advice.push(`${c.name} was ${Math.round((c.value / avg - 1) * 100)}% above your 3-month average of ${fmt(avg)}. Getting back to that average would free up ${fmt(c.value - avg)} a month.`);
        });
    }

    const regular = regularPayments(transactions, cur, end).slice(0, 3);
    if (regular.length) {
      comments.advice.push(`${regular.length === 1 ? 'This looks like a regular payment' : 'These look like regular payments'}: ${listOf(regular.map(r => `${r.name} (about ${fmt(r.yearly)} a year)`))}. Check you still get value from ${regular.length === 1 ? 'it' : 'each one'}.`);
    }

    const flexible = categories.filter(c => FLEXIBLE.includes(c.name));
    const flexTotal = flexible.reduce((s, c) => s + c.value, 0);
    if (flexTotal > 0 && (income <= 0 || flexTotal / income >= 0.1)) {
      comments.advice.push(`${listOf(flexible.map(c => c.name))} came to ${fmt(flexTotal)}${income > 0 ? `, ${Math.round((flexTotal / income) * 100)}% of your income` : ''}. This is usually the easiest spending to adjust: cutting it by a tenth would free up about ${fmt(flexTotal * 0.1 * yearly)} a year.`);
    }

    const housing = categories.find(c => c.name === 'Housing');
    if (housing && income > 0 && housing.value / income > 0.35) {
      comments.advice.push(`Housing took ${Math.round((housing.value / income) * 100)}% of your income. A common guide is around 30%, so it's worth reviewing when your rent or mortgage next comes up for renewal.`);
    }

    const frequent = dayToDay.filter(c => !NOT_TRIMMED.includes(c.name) && c.name !== 'Housing' && c.name !== 'Utilities'
      && (c.items.length / days) * 30 >= 8 && c.value / c.items.length <= spending * 0.05)[0];
    if (frequent) {
      const each = frequent.value / frequent.items.length;
      comments.advice.push(`You made ${frequent.items.length} ${frequent.name} purchases averaging ${fmt(each)}. Small amounts add up: one fewer a week would save about ${fmt(each * 52)} a year.`);
    }

    if (income > 0 && saved < income * 0.2) {
      const needed = income * 0.2 - saved;
      const target = income * 0.8 - debtRepaid;
      if (left >= needed) {
        comments.advice.push(`You had ${fmt(left)} left over. Moving ${fmt(needed)} of it into savings would take you to 20% of your income.`);
      } else if (target > 0 && spending - debtRepaid > target) {
        comments.advice.push(`Saving 20% of your income would mean keeping other spending under ${fmt(target)}, which is ${fmt(spending - debtRepaid - target)} less than this period.`);
      }
    }
    comments.advice = comments.advice.slice(0, 5);
  }

  // ── Savings and investments ────────────────────────────────────────────
  if (saved > 0) {
    const top = savings.byCategory[0];
    comments.savings.push(`You added ${fmt(saved)}, ${income > 0 ? `${Math.round(savingsRate * 100)}% of your income` : 'with no income recorded'}${against(saved, prev.saved)}.${savings.byCategory.length > 1 ? ` The most went to ${top.name}, at ${fmt(top.value)}.` : ''}`);
  } else if (cur.count > 0) {
    comments.savings.push('Nothing was added to savings or investments in this period.');
  }
  if (savings.held.length) {
    const gain = savings.value - savings.cost;
    const pct  = savings.cost > 0 ? ` (${Math.round((Math.abs(gain) / savings.cost) * 100)}%)` : '';
    comments.savings.push(`Your investments are worth ${fmt(savings.value)} today, ${fmt(Math.abs(gain))}${pct} ${gain >= 0 ? 'more' : 'less'} than you put in.`);
    if (savings.held.length > 1) {
      const best = [...savings.held].sort((a, b) => b.gain - a.gain)[0];
      if (best.gain > 0) comments.savings.push(`${best.name} has gained the most, at ${fmt(best.gain)}.`);
    }
  }
  savings.cashedOut.forEach(a => {
    const gain = (a.cashedOutAmount || 0) - (a.costBasis || 0);
    comments.savings.push(`You cashed out ${a.name} on ${fmtDay(a.cashedOutDate)} for ${fmtCur(a.cashedOutAmount || 0, a.currency)}, ${fmtCur(Math.abs(gain), a.currency)} ${gain >= 0 ? 'more' : 'less'} than you put in.`);
  });
  savings.maturing.forEach(a => comments.savings.push(`${a.name} matures on ${fmtDay(a.maturityDate)}, so it's time to decide whether to reinvest it.`));

  const monthlySpend = ((spending - debtRepaid) / days) * 30.4;
  if (!thin && days >= 28 && monthlySpend > 0) {
    const months = position.cash / monthlySpend;
    if (months < 3) {
      comments.savings.push(`Your cash would cover about ${months < 0 ? 0 : months.toFixed(1)} months of spending at this rate. A common target is 3 to 6 months, so building that cushion is worth doing first.`);
    } else {
      comments.savings.push(`Your cash would cover about ${months.toFixed(1)} months of spending at this rate${months > 6 ? ', above the common 3 to 6 month target, so some of it could be working harder in savings or investments' : ', within the common 3 to 6 month target'}.`);
    }
  }

  const over = budget.rows.filter(r => r.type === 'expense' && r.actual > r.budget + 0.005)
    .sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget));
  const expenseBudgets = budget.rows.filter(r => r.type === 'expense');
  if (expenseBudgets.length) {
    comments.budgets.push(over.length
      ? `You${partial ? ' are' : ' went'} over budget in ${over.length} of ${expenseBudgets.length} spending ${expenseBudgets.length === 1 ? 'category' : 'categories'}${soFar}.`
      : `You${partial ? ' are' : ' stayed'} within ${expenseBudgets.length === 1 ? 'your spending budget' : `all ${expenseBudgets.length} spending budgets`}${soFar}.`);
    over.slice(0, 3).forEach(r => comments.budgets.push(`${r.category} is ${fmt(r.actual - r.budget)} over its ${fmt(r.budget)} budget.`));
  }
  budget.rows.filter(r => r.type === 'savings' && r.actual < r.budget - 0.005).slice(0, 2)
    .forEach(r => comments.budgets.push(`${r.category} is ${fmt(r.budget - r.actual)} short of its ${fmt(r.budget)} savings target${soFar}.`));
  budget.rows.filter(r => r.type === 'income' && r.actual < r.budget - 0.005).slice(0, 2)
    .forEach(r => comments.budgets.push(`${r.category} is ${fmt(r.budget - r.actual)} below the ${fmt(r.budget)} you planned${soFar}.`));

  if (debtRepaid > 0) {
    comments.debts.push(`You repaid ${fmt(debtRepaid)} across ${plural(debt.repayments.length, 'debt')}${against(debtRepaid, prev.debtRepaid)}.`);
  }
  debt.cleared.forEach(d => {
    comments.debts.push(`${d.name} was paid off on ${fmtDay(d.paidOffDate)}.${d.settlementDiscount > 0 ? ` Settling early saved you ${fmtCur(d.settlementDiscount, d.currency)}.` : ''}`);
  });
  const newBorrowing = debt.borrowed.reduce((s, b) => s + b.value, 0);
  if (debt.borrowed.length) {
    comments.debts.push(`You received ${fmt(newBorrowing)} in new loans, from ${listOf([...new Set(debt.borrowed.map(b => b.name))])}. This isn't counted as income.`);
  }
  if (debt.open.length) {
    comments.debts.push(`You owe ${fmt(debt.owedToday)} today across ${plural(debt.open.length, 'debt')}.`);
  } else if (debts.length) {
    comments.debts.push('You have no debts outstanding today.');
  }

  if (history.opening && history.closing) {
    const { netWorth: from } = history.opening;
    const { netWorth: to }   = history.closing;
    const moved = to - from;
    comments.position.push(`Your net worth went from ${fmt(from)} to ${fmt(to)}${soFar} over this period, ${moved >= 0 ? 'up' : 'down'} ${fmt(Math.abs(moved))}.`);
  }

  // ── Key events ─────────────────────────────────────────────────────────
  const highlights = [];
  debt.cleared.forEach(d => highlights.push(`${d.name} was paid off`));
  if (largest[0] && cur.expenses.length > 1) highlights.push(`Largest expense: ${quoted(largest[0])}, ${fmt(largest[0].baseAmount)}`);
  if (debt.borrowed.length) highlights.push(`New borrowing of ${fmt(newBorrowing)}`);
  savings.cashedOut.forEach(a => highlights.push(`${a.name} was cashed out`));
  if (over.length) highlights.push(`Biggest budget overrun: ${over[0].category}, ${fmt(over[0].actual - over[0].budget)}`);

  // ── Next steps ─────────────────────────────────────────────────────────
  const nextSteps = [];
  if (!thin) {
    if (income > 0 && spending - debtRepaid > income && dayToDay[0]) {
      nextSteps.push(`Spending passed income even before debt repayments. ${dayToDay[0].name} is the largest category, so it's the first place to look.`);
    } else if (income > 0 && spending > income) {
      nextSteps.push('Debt repayments took spending past income. If they were one-off, this should settle next period.');
    }
    if (over[0]) nextSteps.push(`Review your ${over[0].category} budget: either the budget needs raising or the spending needs trimming.`);
    if (!budget.rows.length && budget.months.length && dayToDay[0]) {
      nextSteps.push(`You have no budgets for this period. ${dayToDay[0].name} is a good place to start, at ${fmt(dayToDay[0].value)}.`);
    }
    const costly = debt.open.filter(d => Number(d.interestRate) > 0).sort((a, b) => b.interestRate - a.interestRate)[0];
    if (costly && debt.open.length > 1) {
      nextSteps.push(`${costly.name} has your highest interest rate at ${costly.interestRate}%, so extra repayments there save the most.`);
    }
  }

  return {
    period, end, partial, days, compare, hasPrev, thin, empty: cur.count === 0,
    totals: { income, spending, saved, left, debtRepaid, savingsRate, count: cur.count },
    changes: { income: change(income, prev.incomeTotal), spending: change(spending, prev.spending), saved: change(saved, prev.saved) },
    trend: trendFor(txs, period.start, end),
    categories, incomeSources, largest, budget, debt, position, history, savings,
    comments, highlights: highlights.slice(0, 5), nextSteps: nextSteps.slice(0, 3),
  };
}
