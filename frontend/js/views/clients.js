import { api } from '../api.js';
import { hbar } from '../charts.js';
import { errorState, esc, pageHead, pct, skeleton } from '../ui.js';

export default async function clientsView(root) {
  root.innerHTML = skeleton(1);
  let c;
  try { c = await api.get('/metrics/top-clients?n=10'); } catch (e) { root.innerHTML = errorState(e.message); return; }
  const top3 = c.top.slice(0, 3).reduce((a, r) => a + r.share, 0);
  root.innerHTML = `
    ${pageHead('Clients', 'Is one company responsible for a large share of escalations? If so, the fix is with that client, not with the process.')}
    <div class="callout ${c.alert ? '' : 'good'}"><span>${c.alert
      ? `<b>Alert:</b> at least one client causes ${pct(c.alert_share)} or more of all escalations.`
      : `<b>No single client is the problem.</b> The top 3 clients cause only ${pct(top3, 1)} of escalations, across ${c.clients} clients. An alert fires above ${pct(c.alert_share)} for one client.`}</span></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Top 10 clients by escalations</h3></div>
        ${c.top.map((r) => `<div class="rowbar"><div><b>${esc(r.client_name)}</b><div class="muted" style="font-size:12px">${r.escalated} of ${r.tickets} tickets escalated</div></div>${hbar(r.share, c.alert_share, r.alert ? 'red' : '')}<span class="num">${pct(r.share, 1)}</span></div>`).join('')}
        <p class="fine" style="margin-top:8px">The bar is full at the ${pct(c.alert_share)} alert line.</p></div>
      <div class="card"><div class="card-h"><h3>Worth watching</h3></div>
        ${c.watch.length ? c.watch.map((r) => `<div class="rowbar" style="grid-template-columns:minmax(0,1fr) 70px"><div><b>${esc(r.client_name)}</b><div class="muted" style="font-size:12px">${r.escalated} of ${r.tickets} tickets escalated</div></div><span class="num">${pct(r.rate)}</span></div>`).join('') : '<p class="muted">No client stands out.</p>'}
        <p class="fine" style="margin-top:8px">Clients with 10 or more tickets where 60% or more were escalated, outside the top 10. Small numbers, so check before acting.</p></div>
    </div>`;
}
