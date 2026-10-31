// Chart colours per theme (SVG attributes can't read CSS variables, so they're picked in JS)
export const CHART_THEME = {
  dark:  { tick: '#7aaa8c', grid: '#1e2b23', tipBg: '#101512', tipBorder: '#1e2b23', tipText: '#eaf5ef',
           income: '#00a854', budget: '#26302a', budgetHi: '#2c5a3e', spent: '#00a854', spentHi: '#00e676', over: '#e5484d' },
  light: { tick: '#4a7d5e', grid: '#cdddd4', tipBg: '#ffffff', tipBorder: '#cdddd4', tipText: '#0d1a14',
           income: '#00a854', budget: '#dde3df', budgetHi: '#b3d3be', spent: '#00a854', spentHi: '#008a45', over: '#00582c' },
  sapphire: { tick: 'rgba(214,224,255,0.7)', grid: 'rgba(255,255,255,0.10)', tipBg: 'rgba(14,22,80,0.95)', tipBorder: 'rgba(255,255,255,0.18)', tipText: '#ffffff',
           income: '#2ee6a8', budget: 'rgba(255,255,255,0.16)', budgetHi: 'rgba(255,255,255,0.32)', spent: '#8fb0ff', spentHi: '#c3d3ff', over: '#ff5c7a' },
  navy:  { tick: '#4a4f72', grid: '#e3e5ee', tipBg: '#ffffff', tipBorder: '#e3e5ee', tipText: '#14173a',
           income: '#12a37f', budget: '#dcdfec', budgetHi: '#bcc1e0', spent: '#3a4190', spentHi: '#2b3170', over: '#0d1033' },
};

// Categorical palette for donut charts: distinct hues in a fixed order, validated for colour-blind
// separation against each theme's card surface. Past 7 categories the smallest fold into "Other"
// (neutral grey) rather than reusing a colour.
export const DONUT_PALETTE = {
  sapphire: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'],
  navy:  ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'],
  dark:  ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'],
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'],
};
const OTHER_COLOR  = { dark: '#6b7a71', light: '#9aa59f', navy: '#9aa0b8', sapphire: '#7a84b8' };

// [name, value] pairs → largest-first slices with colours; folds the tail into "Other" past 7
export function toDonutSlices(entries, theme) {
  const palette = DONUT_PALETTE[theme];
  const sorted  = entries.sort((a, b) => b[1] - a[1]);
  const shown   = sorted.length > palette.length ? sorted.slice(0, palette.length - 1) : sorted;
  const rest    = sorted.slice(shown.length).reduce((sum, [, v]) => sum + v, 0);
  const slices  = shown.map(([name, value], i) => ({ name, value, color: palette[i] }));
  if (rest > 0) slices.push({ name: 'Other', value: rest, color: OTHER_COLOR[theme] });
  return slices;
}
