import { Hbar, WeeklyChart } from '@/components/charts';
import { PageHead, StatCard } from '@/components/ui';
import { num } from '@/lib/format';
import { getJSON } from '@/lib/server-api';
import type { Any } from '@/lib/types';

export const metadata = { title: 'Backlog' };

export default async function Backlog() {
  const [weekly, s, trend]: Any[] = await Promise.all(['/metrics/weekly', '/metrics/summary', '/metrics/category-trend'].map((p) => getJSON(p)));
  const full = weekly.slice(1, -1), avg = (k: string) => full.reduce((a: number, w: Any) => a + w[k], 0) / full.length;
  const maxM = Math.max(...s.monthly.map((m: Any) => m.tickets)), maxC = Math.max(...trend.map((c: Any) => Math.abs(c.change)));
  return (
    <>
      <PageHead title="Backlog" sub="The backlog grows when tickets are created faster than they are closed. This page shows where the extra volume comes from." />
      <div className="grid g3">
        <StatCard label="Created per week" value={avg('created').toFixed(0)} sub="Average over complete weeks" />
        <StatCard label="Closed per week" value={avg('closed').toFixed(0)} sub="Average over complete weeks" />
        <StatCard label="Open at 30 Sep" value={num(weekly[weekly.length - 1].open_at_end)} sub={`${weekly[0].open_at_end} open at the end of the first week`} />
      </div>
      <div className="card"><div className="card-h"><h3>Created, closed and still open, per week</h3>
        <div className="chart-legend"><span style={{ ['--c' as Any]: 'var(--amber)' }}>Created</span><span style={{ ['--c' as Any]: '#44444b' }}>Closed</span><span style={{ ['--c' as Any]: '#fff' }}>Open at week end</span></div></div>
        <WeeklyChart rows={weekly} /><p className="fine" style={{ marginTop: 6 }}>The first and last weeks are partial (data runs 2 Jul to 30 Sep).</p></div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card"><div className="card-h"><h3>Tickets by month</h3></div>
          {s.monthly.map((m: Any, i: number) => (
            <div key={m.month} className="rowbar" style={{ gridTemplateColumns: '50px minmax(0,1fr) 110px' }}><b>{m.month}</b><Hbar value={m.tickets} max={maxM} />
              <span className="num">{m.tickets}{i ? ` (+${Math.round((m.tickets / s.monthly[0].tickets - 1) * 100)}%)` : ''}</span></div>))}
          <p className="fine" style={{ marginTop: 8 }}>Escalations rose with volume: {s.monthly.map((m: Any) => m.escalated).join(', ')} in Jul, Aug and Sep.</p></div>
        <div className="card"><div className="card-h"><h3>Which categories grew, July to September</h3></div>
          {trend.map((c: Any) => (
            <div key={c.category} className="rowbar" style={{ gridTemplateColumns: 'minmax(0,1fr) 90px 70px' }}>
              <div><b>{c.category}</b><div className="muted" style={{ fontSize: 12 }}>{c.jul} in Jul, {c.sep} in Sep</div></div>
              <Hbar value={Math.abs(c.change)} max={maxC} tone={c.change < 0 ? 'gray' : ''} /><span className="num">{c.change > 0 ? '+' : ''}{c.change}</span></div>))}</div>
      </div>
    </>
  );
}
