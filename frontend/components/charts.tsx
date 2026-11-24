import type { Any } from '@/lib/types';

/** Small bar chart with the dashed "Avg" line and the tallest bar highlighted. */
export function MiniBars({ values, label = 'Bar chart' }: { values: number[]; label?: string }) {
  const max = Math.max(...values) || 1;
  const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const top = values.indexOf(Math.max(...values));
  return (
    <div className="bars" role="img" aria-label={label}>
      {values.map((v, i) => <i key={i} className={i === top ? 'on' : ''} style={{ height: `${Math.max((v / max) * 100, 3)}%` }} />)}
      <div className="avg" style={{ bottom: `${(avg / max) * 100}%` }}><b>Avg</b></div>
    </div>
  );
}

/** Horizontal bar. tone: '' (amber), red, green, gray. */
export function Hbar({ value, max, tone = '' }: { value: number; max: number; tone?: string }) {
  return <div className={`hb ${tone}`}><i style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%` }} /></div>;
}

/** Created vs closed per week (bars) with open-at-week-end (line). */
export function WeeklyChart({ rows }: { rows: Any[] }) {
  const W = 720, H = 250, L = 38, R = 10, T = 14, B = 30;
  const top = Math.ceil(Math.max(...rows.flatMap((r) => [r.created, r.closed, r.open_at_end])) / 20) * 20 || 20;
  const gw = (W - L - R) / rows.length, bw = Math.min(16, gw * 0.3);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const pts = rows.map((r, i) => [L + gw * i + gw / 2, y(r.open_at_end)]);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tickets created and closed per week, with open tickets at week end">
      {[0, 1, 2, 3, 4].map((i) => { const v = (top / 4) * i; return <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.07)" /><text x={L - 8} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text></g>; })}
      {rows.map((r, i) => {
        const gx = L + gw * i + gw / 2;
        return (
          <g key={r.week}>
            <rect x={gx - bw - 1} y={y(r.created)} width={bw} height={H - B - y(r.created)} rx={2} fill="var(--amber)"><title>{`${r.week}: ${r.created} created`}</title></rect>
            <rect x={gx + 1} y={y(r.closed)} width={bw} height={H - B - y(r.closed)} rx={2} fill="#44444b"><title>{`${r.week}: ${r.closed} closed`}</title></rect>
            {rows.length <= 14 || i % 2 === 0 ? <text x={gx} y={H - 10} textAnchor="middle">{r.week}</text> : null}
          </g>
        );
      })}
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      {pts.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={2.6} fill="#09090a" stroke="#fff" strokeWidth={1.4}><title>{`${rows[i].week}: ${rows[i].open_at_end} open at week end`}</title></circle>)}
    </svg>
  );
}

/** Line chart over weeks, with optional dashed baseline and target lines. */
export function LineChart({ points, fmt = (v: number) => String(v), baseline = null, target = null, h = 170 }:
  { points: { label: string; y: number }[]; fmt?: (v: number) => string; baseline?: number | null; target?: number | null; h?: number }) {
  const W = 460, H = h, L = 46, R = 14, T = 14, B = 26;
  const vals = [...points.map((p) => p.y), baseline, target].filter((v) => v != null) as number[];
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.18 || 0.05;
  const yMin = lo >= 0 ? Math.max(0, lo - pad) : lo - pad, yMax = hi + pad;
  const y = (v: number) => T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin));
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
  const ref = (v: number | null, color: string, label: string) => v == null ? null : (
    <g><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={color} strokeDasharray="5 4" strokeWidth={1.2} /><text x={W - R} y={y(v) - 5} textAnchor="end" style={{ fill: color }}>{label}</text></g>);
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weekly trend">
      {[0, 1, 2, 3].map((i) => { const v = yMin + ((yMax - yMin) / 3) * i; return <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.07)" /><text x={L - 8} y={y(v) + 4} textAnchor="end">{fmt(v)}</text></g>; })}
      {ref(baseline, '#b8b8c0', 'Baseline')}{ref(target, '#4ade80', 'Target')}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')} fill="none" stroke="var(--amber)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.y)} r={3.2} fill="#09090a" stroke="var(--amber2)" strokeWidth={1.6}><title>{`${p.label}: ${fmt(p.y)}`}</title></circle>)}
      {ticks.map((i, k) => <text key={k} x={x(i)} y={H - 7} textAnchor={k === 2 ? 'end' : k === 0 ? 'start' : 'middle'}>{points[i].label}</text>)}
    </svg>
  );
}
