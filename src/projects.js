// Business / side projects: transactions tagged with a projectId are tracked against the project
// and kept out of personal spending, budgets and dashboard figures (they still move account balances).

export const PROJECT_COLORS = ['#3b82f6', '#00b85a', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#6b7280'];

export const isPersonal = (t) => !t.projectId;

/** Totals for one project, in the base currency (each transaction at its saved rate of the day). */
export function projectStats(project, transactions) {
  const txs = transactions
    .filter(t => t.projectId === project.id && t.type !== 'transfer')
    .sort((a, b) => b.date.localeCompare(a.date));
  let putIn = 0, earned = 0;
  const byCategory = {};
  for (const t of txs) {
    if (t.type === 'income') earned += t.baseAmount || 0;
    else {
      putIn += t.baseAmount || 0;
      byCategory[t.category] = (byCategory[t.category] || 0) + (t.baseAmount || 0);
    }
  }
  const net = earned - putIn;
  return {
    txs, putIn, earned, net,
    budgetPct: project.budget > 0 ? (putIn / project.budget) * 100 : null,
    categories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]),
    lastDate: txs[0]?.date || null,
  };
}
