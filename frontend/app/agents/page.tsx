import { PageHead } from '@/components/ui';
import { pct } from '@/lib/format';
import { getJSON } from '@/lib/server-api';
import type { Any } from '@/lib/types';

export const metadata = { title: 'Agents' };
const flagTone = (f: string) => (f.startsWith('Many') || f.startsWith('Escal') ? 't-amber' : 't-red');

export default async function Agents() {
  const [agents, s]: Any[] = await Promise.all(['/metrics/agents', '/metrics/summary'].map((p) => getJSON(p)));
  const fast = [...agents].sort((a: Any, b: Any) => a.median_hours - b.median_hours)[0];
  const heavy = [...agents].sort((a: Any, b: Any) => b.avoidable_rate - a.avoidable_rate)[0];
  return (
    <>
      <PageHead title="Agents" sub="Speed on its own hides problems. This view puts speed next to escalations and reopens, so coaching can be specific." />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <div className="card"><div className="stat-l">Fastest closer</div><div className="big">{fast.agent}</div>
          <div className="kv" style={{ marginTop: 8 }}><span>Median close time</span><b>{fast.median_hours}h</b><span>Reopened</span><b>{pct(fast.reopen_rate)} (team {pct(s.reopen_rate)})</b><span>CSAT</span><b>{fast.csat}</b></div>
          <p className="fine" style={{ marginTop: 10 }}>Closing early creates reopens, and a reopened ticket scores lower with the client.</p></div>
        <div className="card"><div className="stat-l">Most avoidable escalations</div><div className="big">{heavy.agent}</div>
          <div className="kv" style={{ marginTop: 8 }}><span>Escalations</span><b>{heavy.escalated}</b><span>Not real fixes</span><b>{pct(heavy.avoidable_rate)} (team {pct(s.avoidable_rate)})</b><span>Escalation rate</span><b>{pct(heavy.escalation_rate)}</b></div>
          <p className="fine" style={{ marginTop: 10 }}>A coaching conversation, not a ticket rule. Check this against how the agent&apos;s tickets are assigned first.</p></div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Agent</th><th>Tickets</th><th>Median hours to close</th><th>Escalated</th><th>Avoidable escalations</th><th>Reopened</th><th>CSAT</th><th>Flags</th></tr></thead><tbody>
        {agents.map((a: Any) => (
          <tr key={a.agent} style={{ cursor: 'default' }}><td><b>{a.agent}</b></td><td className="num">{a.tickets}</td><td className="num">{a.median_hours}h</td><td className="num">{pct(a.escalation_rate)}</td>
            <td className="num">{pct(a.avoidable_rate)} of {a.escalated}</td><td className="num">{pct(a.reopen_rate)}</td><td className="num">{a.csat}</td>
            <td><div className="tags">{a.flags.length ? a.flags.map((f: string) => <span key={f} className={`pill ${flagTone(f)}`}>{f}</span>) : <span className="muted">None</span>}</div></td></tr>))}</tbody></table></div>
      <p className="fine">Flags: reopen rate at least twice the team&apos;s, escalation rate at least 1.5 times the team&apos;s, or 65% or more of 20+ escalations not real fixes.</p>
    </>
  );
}
