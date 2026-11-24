import Link from 'next/link';
import type { ReactNode } from 'react';
import { MiniBars } from '@/components/charts';
import { PageHead } from '@/components/ui';
import { num, pct } from '@/lib/format';
import { getJSON } from '@/lib/server-api';
import type { Any } from '@/lib/types';

export const metadata = { title: 'Overview' };

function Finding({ href, label, value, sub, chart }: { href: string; label: string; value: ReactNode; sub: string; chart: ReactNode }) {
  return <Link className="card link" href={href}><div className="stat-l">{label}</div><div className="big">{value}</div><div className="stat-s">{sub}</div>{chart}<span className="more">See the detail →</span></Link>;
}

export default async function Overview() {
  const [s, q, bounce, agents, success]: Any[] = await Promise.all(['/metrics/summary', '/queue', '/metrics/bounce', '/metrics/agents', '/metrics/success'].map((p) => getJSON(p)));
  const [jul, , sep] = s.monthly, growth = sep.tickets / jul.tickets - 1;
  const hours = success.measures.find((m: Any) => m.key === 'median_hours');
  const h0 = bounce.by_handoffs[0], h3 = bounce.by_handoffs[3];
  const fast = [...agents].sort((a: Any, b: Any) => a.median_hours - b.median_hours)[0];
  return (
    <>
      <PageHead title="Overview" sub="What is driving the open-ticket count, and what this tool does about it." />
      <div className="callout"><span><b>{q.totals.l1_action} of the {q.totals.open} open tickets are waiting on L1 to act</b>, not on engineering. Engineering has already answered them: sent back for info or config, flagged as a duplicate, or fixed and waiting to be closed.</span>
        <span className="grow" /><Link className="btn primary" href="/queue">Open the queue</Link></div>
      <div className="grid g4">
        <Finding href="/backlog" label="Volume" value={`+${Math.round(growth * 100)}%`} sub={`${jul.tickets} tickets in July, ${sep.tickets} in September. Median close time moved only ${hours.baseline}h to ${hours.latest}h.`} chart={<MiniBars values={success.weekly.filter((w: Any) => !w.partial).map((w: Any) => w.tickets)} label="Tickets per week" />} />
        <Finding href="/escalations" label="Escalations that were not real fixes" value={pct(s.avoidable_rate)} sub={`${s.avoidable} of ${s.escalated} escalations came back as info, config, duplicate, how-to or not reproducible.`} chart={<MiniBars values={Object.values(s.outcomes) as number[]} label="Engineering outcomes" />} />
        <Finding href="/escalations" label="Cost of bouncing" value={<>{h0.median_hours}<small>to</small>{h3.median_hours}h</>} sub={`Median time to close with 0 and with 3 handoffs. CSAT falls from ${h0.csat} to ${h3.csat}.`} chart={<MiniBars values={bounce.by_handoffs.map((r: Any) => r.median_hours)} label="Median hours by handoffs" />} />
        <Finding href="/agents" label="Fast is not solved" value={pct(fast.reopen_rate)} sub={`${fast.agent} closes fastest (${fast.median_hours}h) but ${pct(fast.reopen_rate)} of those tickets are reopened. The team is at ${pct(s.reopen_rate)}.`} chart={<MiniBars values={agents.map((a: Any) => a.reopen_rate)} label="Reopen rate by agent" />} />
      </div>
      <div className="card-h" style={{ margin: '6px 0 0' }}><h3>What the tool does for the L1 agent</h3></div>
      <div className="grid g3 steps">
        <div className="card step"><h3>Collect first</h3><p>The escalation gate lists the details engineering usually needs, so the ticket is not sent back for missing information.</p></div>
        <div className="card step"><h3>Check history</h3><p>The known-issue matcher shows how earlier tickets with the same issue ended, before another escalation is raised.</p></div>
        <div className="card step"><h3>Close with care</h3><p>The reopen guard shows a closing checklist and the predicted reopen risk, so a fast close does not come back.</p></div>
      </div>
      <p className="fine">Advice only: nothing is blocked and P1 tickets are never held. Whether it lowers the avoidable-escalation rate has to be measured in a pilot, see Success measure and Backtest. {num(s.tickets)} tickets analysed.</p>
    </>
  );
}
