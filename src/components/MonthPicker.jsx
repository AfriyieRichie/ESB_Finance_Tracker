import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const key = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return key(d.getFullYear(), d.getMonth() + 1);
};

export const monthLabel = (ym, style = 'long') => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: style, year: 'numeric' });
};

/**
 * Month navigation for the dashboard: ‹ Prev. month · [Month ▾] · Next ›.
 * value / latest / earliest are 'YYYY-MM'; withData is a Set of months that have transactions.
 */
export default function MonthPicker({ value, latest, earliest, withData, onChange }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const ref = useRef(null);
  const minYear = Number((earliest || latest).slice(0, 4));
  const maxYear = Number(latest.slice(0, 4));

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [open]);

  const atLatest = value >= latest;
  const pick = (ym) => { onChange(ym); setOpen(false); };

  return (
    <div className="month-picker" ref={ref}>
      <button type="button" className="mp-step" onClick={() => onChange(shiftMonth(value, -1))} title="Previous month">
        <ChevronLeft size={15} strokeWidth={2} /> <span className="mp-step-label">Prev. month</span>
      </button>

      <button type="button" className="month-badge mp-current" aria-expanded={open}
        onClick={() => { setYear(Number(value.slice(0, 4))); setOpen(o => !o); }}>
        {monthLabel(value)} <ChevronDown size={13} strokeWidth={2} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.18s ease' }} />
      </button>

      <button type="button" className="mp-step" onClick={() => onChange(shiftMonth(value, 1))} disabled={atLatest} title="Next month">
        <span className="mp-step-label">Next</span> <ChevronRight size={15} strokeWidth={2} />
      </button>

      {open && (
        <div className="mp-menu" role="dialog" aria-label="Choose a month">
          <div className="mp-year">
            <button type="button" className="mp-year-btn" onClick={() => setYear(y => y - 1)} disabled={year <= minYear}>
              <ChevronLeft size={15} strokeWidth={2} />
            </button>
            <b>{year}</b>
            <button type="button" className="mp-year-btn" onClick={() => setYear(y => y + 1)} disabled={year >= maxYear}>
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          </div>
          <div className="mp-grid">
            {MONTHS.map((name, i) => {
              const ym = key(year, i + 1);
              const future = ym > latest;
              return (
                <button key={ym} type="button" disabled={future}
                  className={`mp-month ${ym === value ? 'active' : ''} ${withData.has(ym) ? 'has-data' : ''}`}
                  onClick={() => pick(ym)}>
                  {name}
                </button>
              );
            })}
          </div>
          {value !== latest && (
            <button type="button" className="auth-switch-link mp-today" onClick={() => pick(latest)}>Back to this month</button>
          )}
        </div>
      )}
    </div>
  );
}
