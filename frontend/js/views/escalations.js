import { api } from '../api.js';
import { hbar } from '../charts.js';
import { errorState, esc, num, pageHead, pct, skeleton, statCard } from '../ui.js';

export default async function escalationsView(root) {
  root.innerHTML = skeleton();
  let s, y, bounce, cats;
  try { [s, y, bounce, cats] = await Promise.all(['/metrics/summary', '/metrics/yield', '/metrics/bounce', '/metrics/categories'].map(api.get)); }
  catch (e) { root.innerHTML = errorState(e.message); return; }

  const maxH = Math.max(...bounce.by_handoffs.map((r) => r.median_hours));
  const outcomes = Object.entries(s.outcomes).sort((a, b) => b[1] - a[1]);
  root.innerHTML = `
    ${pageHead('Escalations', 'Escalations are where time is lost. Fewer avoidable escalations means fewer bounces and a smaller backlog.')}
    <div class="grid g4">
      ${statCard({ label: 'Tickets escalated', value: num(s.escalated), sub: `${pct(s.escalation_rate)} of all tickets` })}
      ${statCard({ label: 'Real engineering fixes', value: pct(y.yield), sub: `${y.fixed} of ${y.escalated} escalations` })}
      ${statCard({ label: 'Avoidable escalations', value: num(s.avoidable), sub: `${pct(s.avoidable_rate)} of escalations` })}
      ${statCard({ label: 'Bounced 2+ times', value: pct(bounce.bounce_rate, 1), sub: 'Of all tickets' })}
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>How escalations ended</h3><small>${y.escalated} escalations</small></div>
        ${outcomes.map(([k, n]) => `<div class="rowbar" style="grid-template-columns:minmax(0,1fr) 120px 80px"><span>${esc(k.replace(' - returned to L1', ''))}</span>${hbar(n, y.escalated, k === 'Fixed' ? 'green' : '')}<span class="num">${n} (${pct(n / y.escalated)})</span></div>`).join('')}
        <p class="fine" style="margin-top:8px">Everything except Fixed is counted as avoidable: it could have been resolved or answered at L1.</p></div>
      <div class="card"><div class="card-h"><h3>What each handoff costs</h3></div>
        ${bounce.by_handoffs.map((r) => `<div class="rowbar" style="grid-template-columns:90px minmax(0,1fr) 150px"><b>${r.handoffs} handoff${r.handoffs === 1 ? '' : 's'}</b>${hbar(r.median_hours, maxH, r.handoffs >= 2 ? 'red' : '')}<span class="num">${r.median_hours}h, CSAT ${r.csat}</span></div>`).join('')}
        <p class="fine" style="margin-top:8px">${num(bounce.by_handoffs.reduce((a, r) => a + r.tickets, 0))} tickets. Median hours to close, with average CSAT.</p></div>
    </div>
    <div class="table-wrap plain"><table><thead><tr><th>Category</th><th>Tickets</th><th>Escalated</th><th>Avoidable</th><th>Median hours to close</th></tr></thead><tbody>
      ${cats.map((c) => `<tr style="cursor:default"><td><b>${esc(c.category)}</b></td><td class="num">${c.tickets}</td><td class="num">${(c.escalation_rate * 100).toFixed(0)}% (${c.escalated})</td><td class="num">${(c.avoidable_rate * 100).toFixed(0)}% (${c.avoidable})</td><td class="num">${c.median_hours}h</td></tr>`).join('')}</tbody></table></div>`;
}
