import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();
const db = getFirestore();

// Local times (in each user's own time zone) at which reminders go out
const DAILY_HOUR   = 20;      // 8pm: "nothing recorded today" reminder
const WEEKLY_DAY   = 'Sun';
const WEEKLY_HOUR  = 18;      // Sunday 6pm: weekly digest
const DEFAULT_TZ   = 'Europe/London';

const SYMBOLS = { GHS: 'GH₵', USD: '$', GBP: '£', EUR: '€', NGN: '₦', ZAR: 'R', KES: 'KSh', XOF: 'CFA', CAD: 'C$', AUD: 'A$' };
const money = (n, cur) =>
  `${SYMBOLS[cur] || cur} ${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Tokens that will never work again; their documents are deleted
const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// ─── Time helpers ──────────────────────────────────────────────────────────

function localNow(timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(new Date());
  } catch {
    return localNow(DEFAULT_TZ);       // unknown/invalid time zone string
  }
  const get = type => parts.find(p => p.type === type)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), weekday: get('weekday') };
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Currency conversion (mirrors the app) ─────────────────────────────────

const rateCache = new Map();   // base → { CODE: units per 1 base }
async function ratesFor(base) {
  if (rateCache.has(base)) return rateCache.get(base);
  const lower = base.toLowerCase();
  let rates = {};
  for (const url of [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${lower}.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${lower}.json`,
  ]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      rates = Object.fromEntries(Object.entries(json[lower] || {}).map(([k, v]) => [k.toUpperCase(), v]));
      break;
    } catch { /* try next source */ }
  }
  rateCache.set(base, rates);
  return rates;
}

// Value of a transaction in the base currency, preferring the rate saved when it was recorded
async function toBase(tx, base, prefs, accountCurrency) {
  if (tx.baseCurrency === base && typeof tx.fxRate === 'number') return tx.amount * tx.fxRate;
  const cur = tx.currency || accountCurrency[tx.accountId] || base;
  if (cur === base) return tx.amount;
  const rate = prefs.fxOverrides?.[`${base}:${cur}`] || (await ratesFor(base))[cur];
  return rate ? tx.amount / rate : 0;
}

// ─── Message builders ──────────────────────────────────────────────────────

async function dailyReminder(uid, today) {
  const snap = await db.collection(`users/${uid}/transactions`).where('date', '==', today).limit(1).get();
  if (!snap.empty) return null;
  return {
    title: 'Anything to record today?',
    body:  "You haven't logged any transactions today. Tap to add them while they're fresh.",
    tag:   'daily-reminder',
  };
}

async function weeklyDigest(uid, prefs, today) {
  const base = prefs.currency || 'GHS';
  const from = addDays(today, -6);
  const [txSnap, acctSnap] = await Promise.all([
    db.collection(`users/${uid}/transactions`).where('date', '>=', from).where('date', '<=', today).get(),
    db.collection(`users/${uid}/accounts`).get(),
  ]);
  const accountCurrency = Object.fromEntries(acctSnap.docs.map(d => [d.id, d.data().currency]));

  if (txSnap.empty) {
    return {
      title: 'Your week in money',
      body:  'No transactions recorded this week. Take a minute to catch up so your budgets stay accurate.',
      tag:   'weekly-digest',
    };
  }

  const totals = { income: 0, expense: 0, savings: 0 };
  const byCategory = {};
  for (const d of txSnap.docs) {
    const tx = d.data();
    if (!(tx.type in totals)) continue;               // skip transfers
    const v = await toBase(tx, base, prefs, accountCurrency);
    totals[tx.type] += v;
    if (tx.type === 'expense') byCategory[tx.category] = (byCategory[tx.category] || 0) + v;
  }
  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  const parts = [
    `Spent ${money(totals.expense, base)}`,
    `income ${money(totals.income, base)}`,
    `saved ${money(totals.savings, base)}`,
  ];
  return {
    title: 'Your week in money',
    body:  `${parts.join(' · ')}.${top ? ` Top spending: ${top[0]} (${money(top[1], base)}).` : ''}`,
    tag:   'weekly-digest',
  };
}

// ─── Sending ───────────────────────────────────────────────────────────────

async function send(tokens, msg) {
  const res = await getMessaging().sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    webpush: { notification: { title: msg.title, body: msg.body, icon: '/pwa-192x192.png', tag: msg.tag } },
    data: { url: '/', tag: msg.tag },
  });
  // Remove registrations for devices that uninstalled the app or revoked permission
  await Promise.all(res.responses.map((r, i) =>
    r.error && DEAD_TOKEN_ERRORS.has(r.error.code) ? tokens[i].ref.delete() : null
  ));
  return res.successCount;
}

async function processUser(uid, tokens) {
  const timeZone = tokens.find(t => t.timeZone)?.timeZone || DEFAULT_TZ;
  const now      = localNow(timeZone);
  const isDaily  = now.hour === DAILY_HOUR;
  const isWeekly = now.weekday === WEEKLY_DAY && now.hour === WEEKLY_HOUR;
  if (!isDaily && !isWeekly) return;

  const metaRef = db.doc(`users/${uid}/meta/notifications`);
  const [prefsSnap, metaSnap] = await Promise.all([db.doc(`users/${uid}/preferences/main`).get(), metaRef.get()]);
  const prefs = prefsSnap.data() || {};
  const n     = { billReminders: true, weeklyDigest: true, ...(prefs.notifications || {}) };
  const meta  = metaSnap.data() || {};
  const done  = {};

  // lastDaily / lastWeekly make retries and overlapping runs safe: at most one of each per day
  if (isDaily && n.billReminders && meta.lastDaily !== now.date) {
    const msg = await dailyReminder(uid, now.date);
    if (msg) await send(tokens, msg);
    done.lastDaily = now.date;
  }
  if (isWeekly && n.weeklyDigest && meta.lastWeekly !== now.date) {
    const msg = await weeklyDigest(uid, prefs, now.date);
    if (msg) await send(tokens, msg);
    done.lastWeekly = now.date;
  }
  if (Object.keys(done).length) await metaRef.set(done, { merge: true });
}

// Runs hourly; each user is handled when it's the right local hour for them.
export const scheduledReminders = onSchedule(
  { schedule: '0 * * * *', timeZone: 'UTC', region: 'europe-west2' },
  async () => {
    const tokenSnap = await db.collectionGroup('pushTokens').get();
    const byUser = new Map();
    tokenSnap.forEach(d => {
      const uid = d.ref.parent.parent?.id;
      if (!uid) return;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid).push({ ref: d.ref, token: d.id, timeZone: d.data().timeZone });
    });

    for (const [uid, tokens] of byUser) {
      try { await processUser(uid, tokens); }
      catch (err) { logger.error(`Reminders failed for ${uid}`, err); }
    }
    logger.info(`Checked ${byUser.size} user(s) with push enabled`);
  }
);
