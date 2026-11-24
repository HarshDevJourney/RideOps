import { LineChart } from '@/components/charts';
import { Delta, PageHead } from '@/components/ui';
import { fmtVal, pct } from '@/lib/format';
import { getJSON } from '@/lib/server-api';
import type { Any } from '@/lib/types';

export const metadata = { title: 'Success measure' };

export default async function Success() {
  const s: Any = await getJSON('/metrics/success');
  const full = s.weekly.filter((w: Any) => !w.partial), by = (k: string) => s.measures.find((m: Any) => m.key === k);
  const primary = by('avoidable_rate'), perWeek = Math.round(full.reduce((a: number, w: Any) => a + w.escalated, 0) / full.length);
  const Trend = ({ k, label, fmt }: { k: string; label: string; fmt: (v: number) => string }) => {
    const m = by(k);
    return (
      <div className="card"><div className="trend-h"><div><div className="stat-l">{label}</div><b>{fmtVal(m.fmt, m.latest)}</b></div><Delta fmt={m.fmt} base={m.baseline} last={m.latest} better={m.better} /></div>
        <LineChart points={full.map((w: Any) => ({ label: w.week, y: w[k] }))} fmt={fmt} baseline={m.baseline} target={m.target} /></div>
    );
  };
  return (
    <>
      <PageHead title="Success measure" sub="How RideOps would know this is working, week by week. The raw open-ticket count is not the goal: closing tickets faster just raises reopens." />
      <div className="callout"><span><b>Primary measure: avoidable escalation rate.</b> Of the tickets escalated each week, how many did engineering <em>not</em> need to fix? It was {fmtVal('pct', primary.baseline)} in the first 4 complete weeks and {fmtVal('pct', primary.latest)} in the last 4. The suggested target is {fmtVal('pct', primary.target, 0)}.</span></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <Trend k="avoidable_rate" label="Avoidable escalation rate" fmt={(v) => pct(v)} />
        <Trend k="bounce_rate" label="Bounce rate (2+ handoffs)" fmt={(v) => pct(v)} />
        <Trend k="reopen_rate" label="Reopen rate (guardrail)" fmt={(v) => pct(v)} />
        <Trend k="median_hours" label="Median hours to close (guardrail)" fmt={(v) => `${v.toFixed(0)}h`} />
      </div>
      <div className="table-wrap plain"><table><thead><tr><th>Measure</th><th>Role</th><th>Baseline</th><th>Latest</th><th>Change</th><th>Suggested target</th><th>How it is calculated</th></tr></thead><tbody>
        {s.measures.map((m: Any) => (
          <tr key={m.key} style={{ cursor: 'default' }}><td><b>{m.label}</b></td><td><span className="role">{m.role}</span></td><td className="num">{fmtVal(m.fmt, m.baseline)}</td><td className="num">{fmtVal(m.fmt, m.latest)}</td>
            <td><Delta fmt={m.fmt} base={m.baseline} last={m.latest} better={m.better} /></td>
            <td className="num">{m.target == null ? 'Do not worsen' : m.key === 'net_backlog' ? 'At or below 0' : fmtVal(m.fmt, m.target, 0)}</td><td className="how">{m.how}</td></tr>))}</tbody></table></div>
      <p className="fine">Baseline is the first 4 complete weeks ({s.baseline_weeks[0]} to {s.baseline_weeks[3]}). Latest is the last 4 ({s.latest_weeks[0]} to {s.latest_weeks[3]}). Weeks group tickets by the day they were created; the partial first and last weeks are left out. Each week has only about {perWeek} escalations, so single weeks swing widely: judge changes on 4-week averages. Targets are assumptions to agree with Ritika. {s.caveat}</p>
    </>
  );
}
