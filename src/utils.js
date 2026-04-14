/**
 * Format a number as GHS (Ghana Cedi) currency.
 * Negative values render as -GH₵X.XX
 */
export const fmt = (n) => {
  const abs = Math.abs(n);
  const formatted = `GH₵${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `-${formatted}` : formatted;
};
