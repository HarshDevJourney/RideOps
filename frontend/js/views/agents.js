import { api } from '../api.js';
import { errorState, esc, pageHead, pct, skeleton } from '../ui.js';

export default async function agentsView(root) {
  root.innerHTML = skeleton(2);
  let agents, s;
  try { [agents, s] = await Promise.all(['/metrics/agents', '/metrics/summary'].map(api.get)); }
  catch (e) { root.innerHTML = errorState(e.message); return; }

  const fast = [...agents].sort((a, b) => a.median_hours - b.median_hours)[0];
  const heavy = [...agents].sort((a, b) => b.avoidable_rate - a.avoidable_rate)[0];
  const flagTone = (f) => (f.startsWith('Many') || f.startsWith('Escal') ? 't-amber' : 't-red');
  root.innerHTML = `
    ${pageHead('Agents', 'Speed on its own hides problems. This view puts speed next to escalations and reopens, so coaching can be specific.')}
    <div class="grid g2" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="card"><div class="stat-l">Fastest closer</div><div class="big">${esc(fast.agent)}</div>
        <div class="kv" style="margin-top:8px"><span>Median close time</span><b>${fast.median_hours}h</b><span>Reopened</span><b>${pct(fast.reopen_rate)} (team ${pct(s.reopen_rate)})</b><span>CSAT</span><b>${fast.csat}</b></div>
        <p class="fine" style="margin-top:10px">Closing early creates reopens, and a reopened ticket scores lower with the client.</p></div>
      <div class="card"><div class="stat-l">Most avoidable escalations</div><div class="big">${esc(heavy.agent)}</div>
        <div class="kv" style="margin-top:8px"><span>Escalations</span><b>${heavy.escalated}</b><span>Not real fixes</span><b>${pct(heavy.avoidable_rate)} (team ${pct(s.avoidable_rate)})</b><span>Escalation rate</span><b>${pct(heavy.escalation_rate)}</b></div>
        <p class="fine" style="margin-top:10px">A coaching conversation, not a ticket rule. Check this against how the agent's tickets are assigned first.</p></div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Agent</th><th>Tickets</th><th>Median hours to close</th><th>Escalated</th><th>Avoidable escalations</th><th>Reopened</th><th>CSAT</th><th>Flags</th></tr></thead><tbody>
      ${agents.map((a) => `<tr style="cursor:default"><td><b>${esc(a.agent)}</b></td><td class="num">${a.tickets}</td><td class="num">${a.median_hours}h</td><td class="num">${pct(a.escalation_rate)}</td>
        <td class="num">${pct(a.avoidable_rate)} of ${a.escalated}</td><td class="num">${pct(a.reopen_rate)}</td><td class="num">${a.csat}</td>
        <td><div class="tags">${a.flags.map((f) => `<span class="pill ${flagTone(f)}">${esc(f)}</span>`).join('') || '<span class="muted">None</span>'}</div></td></tr>`).join('')}</tbody></table></div>
    <p class="fine">Flags: reopen rate at least twice the team's, escalation rate at least 1.5 times the team's, or 65% or more of 20+ escalations not real fixes.</p>`;
}
