import { api } from '../api.js';
import { hbar, weeklyChart } from '../charts.js';
import { errorState, esc, num, pageHead, pct, skeleton, statCard } from '../ui.js';

export default async function backlogView(root) {
  root.innerHTML = skeleton(3);
  let weekly, s, trend;
  try { [weekly, s, trend] = await Promise.all(['/metrics/weekly', '/metrics/summary', '/metrics/category-trend'].map(api.get)); }
  catch (e) { root.innerHTML = errorState(e.message); return; }

  const full = weekly.slice(1, -1), avg = (k) => full.reduce((a, w) => a + w[k], 0) / full.length;
  const maxM = Math.max(...s.monthly.map((m) => m.tickets)), maxC = Math.max(...trend.map((c) => Math.abs(c.change)));
  root.innerHTML = `
    ${pageHead('Backlog', 'The backlog grows when tickets are created faster than they are closed. This page shows where the extra volume comes from.')}
    <div class="grid g3">
      ${statCard({ label: 'Created per week', value: avg('created').toFixed(0), sub: 'Average over complete weeks' })}
      ${statCard({ label: 'Closed per week', value: avg('closed').toFixed(0), sub: 'Average over complete weeks' })}
      ${statCard({ label: 'Open at 30 Sep', value: num(weekly[weekly.length - 1].open_at_end), sub: `${weekly[0].open_at_end} open at the end of the first week` })}
    </div>
    <div class="card"><div class="card-h"><h3>Created, closed and still open, per week</h3>
      <div class="chart-legend"><span style="--c:var(--amber)">Created</span><span style="--c:#44444b">Closed</span><span style="--c:#fff">Open at week end</span></div></div>
      ${weeklyChart(weekly)}<p class="fine" style="margin-top:6px">The first and last weeks are partial (data runs 2 Jul to 30 Sep).</p></div>
    <div class="grid g2" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Tickets by month</h3></div>
        ${s.monthly.map((m, i) => `<div class="rowbar" style="grid-template-columns:50px minmax(0,1fr) 110px"><b>${m.month}</b>${hbar(m.tickets, maxM)}<span class="num">${m.tickets}${i ? ` (${m.tickets >= s.monthly[0].tickets ? '+' : ''}${Math.round((m.tickets / s.monthly[0].tickets - 1) * 100)}%)` : ''}</span></div>`).join('')}
        <p class="fine" style="margin-top:8px">Escalations rose with volume: ${s.monthly.map((m) => `${m.escalated}`).join(', ')} in Jul, Aug and Sep.</p></div>
      <div class="card"><div class="card-h"><h3>Which categories grew, July to September</h3></div>
        ${trend.map((c) => `<div class="rowbar" style="grid-template-columns:minmax(0,1fr) 90px 70px"><div><b>${esc(c.category)}</b><div class="muted" style="font-size:12px">${c.jul} in Jul, ${c.sep} in Sep</div></div>${hbar(Math.abs(c.change), maxC, c.change < 0 ? 'gray' : '')}<span class="num">${c.change > 0 ? '+' : ''}${c.change}</span></div>`).join('')}</div>
    </div>`;
}
