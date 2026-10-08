// Business / side projects: transactions tagged with a projectId are tracked against the project
// and kept out of personal spending, budgets and dashboard figures (they still move account balances).

import { newestFirst } from './txOrder';

export const PROJECT_COLORS = ['#3b82f6', '#00b85a', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#6b7280'];

export const isPersonal = (t) => !t.projectId;

/**
 * Totals for one project.
 * - putIn / earned / net and the category breakdown are in the project's own currency
 *   (project.currency, defaulting to the base currency). A transaction in that currency counts at
 *   its exact amount; one in another currency is converted from its base value (rate of the day)
 *   into the project currency at today's rate.
 * - putInBase / earnedBase / netBase are in the base currency (each transaction at its rate of the
 *   day), used to total several projects that may be in different currencies.
 * `fx` = { baseCurrency, convert } from usePreferences; without it everything is in base currency.
 */
export function projectStats(project, transactions, fx = {}) {
  const { baseCurrency, convert } = fx;
  const currency = project.currency || baseCurrency;
  const inProjectCurrency = (t) => {
    if (currency && t.currency === currency) return t.amount;
    if (!currency || currency === baseCurrency || !convert) return t.baseAmount || 0;
    return convert(t.baseAmount || 0, baseCurrency, currency) ?? 0;
  };

  const txs = transactions
    .filter(t => t.projectId === project.id && t.type !== 'transfer')
    .sort(newestFirst);
  let putIn = 0, earned = 0, putInBase = 0, earnedBase = 0;
  const byCategory = {};
  for (const t of txs) {
    const v = inProjectCurrency(t);
    if (t.type === 'income') { earned += v; earnedBase += t.baseAmount || 0; }
    else {
      putIn += v; putInBase += t.baseAmount || 0;
      byCategory[t.category] = (byCategory[t.category] || 0) + v;
    }
  }
  return {
    currency, txs, putIn, earned, net: earned - putIn,
    putInBase, earnedBase, netBase: earnedBase - putInBase,
    budgetPct: project.budget > 0 ? (putIn / project.budget) * 100 : null,
    categories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]),
    lastDate: txs[0]?.date || null,
  };
}
