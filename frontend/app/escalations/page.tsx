import { Hbar } from '@/components/charts';
import { PageHead, StatCard } from '@/components/ui';
import { num, pct } from '@/lib/format';
import { getJSON } from '@/lib/server-api';
import type { Any } from '@/lib/types';

export const metadata = { title: 'Escalations' };

export default async function Escalations() {
  const [s, y, bounce, cats]: Any[] = await Promise.all(['/metrics/summary', '/metrics/yield', '/metrics/bounce', '/metrics/categories'].map((p) => getJSON(p)));
  const maxH = Math.max(...bounce.by_handoffs.map((r: Any) => r.median_hours));
  const outcomes = Object.entries(s.outcomes).sort((a: Any, b: Any) => b[1] - a[1]) as [string, number][];
  return (
    <>
      <PageHead title="Escalations" sub="Escalations are where time is lost. Fewer avoidable escalations means fewer bounces and a smaller backlog." />
      <div className="grid g4">
        <StatCard label="Tickets escalated" value={num(s.escalated)} sub={`${pct(s.escalation_rate)} of all tickets`} />
        <StatCard label="Real engineering fixes" value={pct(y.yield)} sub={`${y.fixed} of ${y.escalated} escalations`} />
        <StatCard label="Avoidable escalations" value={num(s.avoidable)} sub={`${pct(s.avoidable_rate)} of escalations`} />
        <StatCard label="Bounced 2+ times" value={pct(bounce.bounce_rate, 1)} sub="Of all tickets" />
      </div>
      <div className="grid g2">
        <div className="card"><div className="card-h"><h3>How escalations ended</h3><small>{y.escalated} escalations</small></div>
          {outcomes.map(([k, n]) => (
            <div key={k} className="rowbar" style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 80px' }}><span>{k.replace(' - returned to L1', '')}</span><Hbar value={n} max={y.escalated} tone={k === 'Fixed' ? 'green' : ''} /><span className="num">{n} ({pct(n / y.escalated)})</span></div>))}
          <p className="fine" style={{ marginTop: 8 }}>Everything except Fixed is counted as avoidable: it could have been resolved or answered at L1.</p></div>
        <div className="card"><div className="card-h"><h3>What each handoff costs</h3></div>
          {bounce.by_handoffs.map((r: Any) => (
            <div key={r.handoffs} className="rowbar" style={{ gridTemplateColumns: '90px minmax(0,1fr) 150px' }}><b>{r.handoffs} handoff{r.handoffs === 1 ? '' : 's'}</b><Hbar value={r.median_hours} max={maxH} tone={r.handoffs >= 2 ? 'red' : ''} /><span className="num">{r.median_hours}h, CSAT {r.csat}</span></div>))}
          <p className="fine" style={{ marginTop: 8 }}>{num(bounce.by_handoffs.reduce((a: number, r: Any) => a + r.tickets, 0))} tickets. Median hours to close, with average CSAT.</p></div>
      </div>
      <div className="table-wrap plain"><table><thead><tr><th>Category</th><th>Tickets</th><th>Escalated</th><th>Avoidable</th><th>Median hours to close</th></tr></thead><tbody>
        {cats.map((c: Any) => <tr key={c.category} style={{ cursor: 'default' }}><td><b>{c.category}</b></td><td className="num">{c.tickets}</td><td className="num">{(c.escalation_rate * 100).toFixed(0)}% ({c.escalated})</td><td className="num">{(c.avoidable_rate * 100).toFixed(0)}% ({c.avoidable})</td><td className="num">{c.median_hours}h</td></tr>)}</tbody></table></div>
    </>
  );
}
