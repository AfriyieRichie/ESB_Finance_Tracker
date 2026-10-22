// Money lent to others (receivables). Amounts are in the loan's own currency.
// - principal: what you lent; expected: what you'll get back (principal + any interest)
// - repaid: total received back so far
// Only the unpaid principal counts towards net worth (interest counts as income when received).

export const lendExpected   = (l) => (l.expected > 0 ? l.expected : l.principal) || 0;
export const lendOutstanding = (l) => Math.max(0, lendExpected(l) - (l.repaid || 0));
export const lendPrincipalLeft = (l) => Math.max(0, (l.principal || 0) - (l.repaid || 0));
export const isLendOpen    = (l) => (l.status || 'active') === 'active';
export const isLendOverdue = (l, today = new Date().toISOString().slice(0, 10)) =>
  isLendOpen(l) && !!l.dueDate && l.dueDate < today && lendOutstanding(l) > 0.005;

/** Split a repayment (loan currency) into the part that returns principal and the part that's interest. */
export function splitRepayment(lend, amount) {
  const principalPart = Math.min(amount, lendPrincipalLeft(lend));
  return { principalPart, interestPart: Math.max(0, amount - principalPart) };
}
