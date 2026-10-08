// Transaction order: newest date first; within the same day, the most recently logged first.
// `loggedAt` (ms) is stamped when a transaction is created; older ones without it sort after.
export const newestFirst = (a, b) =>
  (b.date || '').localeCompare(a.date || '') || (b.loggedAt || 0) - (a.loggedAt || 0);
export const oldestFirst = (a, b) => newestFirst(b, a);
