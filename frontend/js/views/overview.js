import { api } from '../api.js';
import { miniBars } from '../charts.js';
import { errorState, num, pageHead, pct, skeleton } from '../ui.js';

export default async function overviewView(root) {
  root.innerHTML = skeleton();
  let s, q, bounce, agents, success;
  try { [s, q, bounce, agents, success] = await Promise.all(['/metrics/summary', '/queue', '/metrics/bounce', '/metrics/agents', '/metrics/success'].map(api.get)); }
  catch (e) { root.innerHTML = errorState(e.message); return; }

  const [jul, , sep] = s.monthly, growth = sep.tickets / jul.tickets - 1;
  const hours = success.measures.find((m) => m.key === 'median_hours');
  const h0 = bounce.by_handoffs[0], h3 = bounce.by_handoffs[3];
  const fast = [...agents].sort((a, b) => a.median_hours - b.median_hours)[0];
  const card = (href, label, value, sub, chart) => `<a class="card link" href="#${href}"><div class="stat-l">${label}</div><div class="big">${value}</div><div class="stat-s">${sub}</div>${chart}<span class="more">See the detail →</span></a>`;

  root.innerHTML = `
    ${pageHead('Overview', 'What is driving the open-ticket count, and what this tool does about it.')}
    <div class="callout"><span><b>${q.totals.l1_action} of the ${q.totals.open} open tickets are waiting on L1 to act</b>, not on engineering. Engineering has already answered them: sent back for info or config, flagged as a duplicate, or fixed and waiting to be closed.</span>
      <span class="grow"></span><a class="btn primary" href="#queue">Open the queue</a></div>
    <div class="grid g4">
      ${card('backlog', 'Volume', `+${Math.round(growth * 100)}%`, `${jul.tickets} tickets in July, ${sep.tickets} in September. Median close time moved only ${hours.baseline}h to ${hours.latest}h.`, miniBars(success.weekly.filter((w) => !w.partial).map((w) => w.tickets), 'Tickets per week'))}
      ${card('escalations', 'Escalations that were not real fixes', pct(s.avoidable_rate), `${s.avoidable} of ${s.escalated} escalations came back as info, config, duplicate, how-to or not reproducible.`, miniBars(Object.values(s.outcomes), 'Engineering outcomes'))}
      ${card('escalations', 'Cost of bouncing', `${h0.median_hours}<small>to</small>${h3.median_hours}h`, `Median time to close with 0 and with 3 handoffs. CSAT falls from ${h0.csat} to ${h3.csat}.`, miniBars(bounce.by_handoffs.map((r) => r.median_hours), 'Median hours by handoffs'))}
      ${card('agents', 'Fast is not solved', pct(fast.reopen_rate), `${fast.agent} closes fastest (${fast.median_hours}h) but ${pct(fast.reopen_rate)} of those tickets are reopened. The team is at ${pct(s.reopen_rate)}.`, miniBars(agents.map((a) => a.reopen_rate), 'Reopen rate by agent'))}
    </div>
    <div class="card-h" style="margin:6px 0 0"><h3>What the tool does for the L1 agent</h3></div>
    <div class="grid g3 steps">
      <div class="card step"><h3>Collect first</h3><p>The escalation gate lists the details engineering usually needs, so the ticket is not sent back for missing information.</p></div>
      <div class="card step"><h3>Check history</h3><p>The known-issue matcher shows how earlier tickets with the same issue ended, before another escalation is raised.</p></div>
      <div class="card step"><h3>Close with care</h3><p>The reopen guard shows a closing checklist and the predicted reopen risk, so a fast close does not come back.</p></div>
    </div>
    <p class="fine">Advice only: nothing is blocked and P1 tickets are never held. Whether it lowers the avoidable-escalation rate has to be measured in a pilot, see Success measure and Backtest.</p>`;
}
