import type { Fmt } from './types';

export const pct = (x?: number | null, d = 0) => (x == null ? '–' : (x * 100).toFixed(d) + '%');
export const num = (x?: number | null) => (x == null ? '–' : Number(x).toLocaleString('en-US'));

/** Format one measure value. fmt: pct | hours | num */
export const fmtVal = (fmt: Fmt, v?: number | null, d = 1) =>
  v == null ? '–' : fmt === 'pct' ? pct(v, d) : fmt === 'hours' ? `${Number(v).toFixed(1)}h` : Number(v).toFixed(Math.abs(v) < 10 ? 1 : 0);

/** Change between two values, as text and a tone. Small moves count as flat. */
export function deltaInfo(fmt: Fmt, base?: number | null, last?: number | null, better: 'lower' | 'higher' = 'lower') {
  if (base == null || last == null) return null;
  const diff = last - base, tiny = fmt === 'pct' ? 0.01 : fmt === 'hours' ? 1 : 0.1;
  if (Math.abs(diff) < tiny) return { text: 'Flat', tone: 'flat' };
  const sign = diff >= 0 ? '+' : '';
  const text = fmt === 'pct' ? `${sign}${(diff * 100).toFixed(1)} pts` : fmt === 'hours' ? `${sign}${diff.toFixed(1)}h` : `${sign}${diff.toFixed(1)}`;
  return { text, tone: (better === 'lower') === (diff < 0) ? 'good' : 'bad' };
}
