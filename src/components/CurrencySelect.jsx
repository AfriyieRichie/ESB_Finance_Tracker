import { CURRENCIES, usePreferences } from '../contexts/PreferencesContext';

export default function CurrencySelect({ value, onChange, ...rest }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} {...rest}>
      {CURRENCIES.map(c => (
        <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
      ))}
    </select>
  );
}

// "≈ £12.34" hint for an amount held in a non-base currency; renders nothing for the base currency
export function BaseApprox({ amount, currency, className = 'fx-approx', style }) {
  const { baseCurrency, toBase, fmt } = usePreferences();
  if (!currency || currency === baseCurrency) return null;
  const v = toBase(amount, currency);
  return (
    <span className={className} style={style}>
      {v === null ? 'no rate set' : `≈ ${fmt(v)}`}
    </span>
  );
}
