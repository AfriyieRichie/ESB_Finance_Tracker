// Debts & loans: a debt is "paid off" once nothing is owed. Paid-off debts move to the history.

export const isPaidOff = (d) => (Number(d.currentBalance) || 0) <= 0.005;

/** Repayment history for a debt, from transactions linked to it (amounts in the debt's currency). */
export function repaymentHistory(debt, transactions) {
  const reps = transactions
    .filter(t => t.debtId === debt.id && t.type !== 'transfer')
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalRepaid = reps.reduce((s, t) => s + (t.debtAmount ?? t.amount ?? 0), 0);
  const first = reps[0]?.date || null;
  const last  = reps[reps.length - 1]?.date || null;
  let months = null;
  if (first && (debt.paidOffDate || last)) {
    const a = new Date(first + 'T00:00:00'), b = new Date((debt.paidOffDate || last) + 'T00:00:00');
    months = Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
  }
  return { count: reps.length, totalRepaid, first, last, months };
}
