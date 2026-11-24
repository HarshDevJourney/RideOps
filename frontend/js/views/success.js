import { api } from '../api.js';
import { lineChart } from '../charts.js';
import { deltaPill, errorState, esc, fmtVal, pageHead, pct, skeleton } from '../ui.js';

export default async function successView(root) {
  root.innerHTML = skeleton(2);
  let s;
  try { s = await api.get('/metrics/success'); } catch (e) { root.innerHTML = errorState(e.message); return; }
  const full = s.weekly.filter((w) => !w.partial), by = (k) => s.measures.find((m) => m.key === k);
  const trend = (key, fmt, label, ptsKey = key) => {
    const m = by(key);
    return `<div class="card"><div class="trend-h"><div><div class="stat-l">${esc(label)}</div><b>${fmtVal(m.fmt, m.latest)}</b></div>${deltaPill(m.fmt, m.baseline, m.latest, m.better)}</div>
      ${lineChart(full.map((w) => ({ label: w.week, y: w[ptsKey] })), { fmt, baseline: m.baseline, target: m.target })}</div>`;
  };
  const primary = by('avoidable_rate'), perWeek = Math.round(full.reduce((a, w) => a + w.escalated, 0) / full.length);
  root.innerHTML = `
    ${pageHead('Success measure', 'How RideOps would know this is working, week by week. The raw open-ticket count is not the goal: closing tickets faster just raises reopens.')}
    <div class="callout"><span><b>Primary measure: avoidable escalation rate.</b> Of the tickets escalated each week, how many did engineering <em>not</em> need to fix? It was ${fmtVal('pct', primary.baseline)} in the first 4 complete weeks and ${fmtVal('pct', primary.latest)} in the last 4. The suggested target is ${fmtVal('pct', primary.target, 0)}.</span></div>
    <div class="grid g2" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      ${trend('avoidable_rate', (v) => pct(v), 'Avoidable escalation rate')}
      ${trend('bounce_rate', (v) => pct(v), 'Bounce rate (2+ handoffs)')}
      ${trend('reopen_rate', (v) => pct(v), 'Reopen rate (guardrail)')}
      ${trend('median_hours', (v) => `${v.toFixed(0)}h`, 'Median hours to close (guardrail)')}
    </div>
    <div class="table-wrap plain"><table><thead><tr><th>Measure</th><th>Role</th><th>Baseline</th><th>Latest</th><th>Change</th><th>Suggested target</th><th>How it is calculated</th></tr></thead><tbody>
      ${s.measures.map((m) => `<tr style="cursor:default"><td><b>${esc(m.label)}</b></td><td><span class="role">${esc(m.role)}</span></td><td class="num">${fmtVal(m.fmt, m.baseline)}</td><td class="num">${fmtVal(m.fmt, m.latest)}</td>
        <td>${deltaPill(m.fmt, m.baseline, m.latest, m.better)}</td><td class="num">${m.target == null ? 'Do not worsen' : m.key === 'net_backlog' ? 'At or below 0' : fmtVal(m.fmt, m.target, 0)}</td><td class="how">${esc(m.how)}</td></tr>`).join('')}</tbody></table></div>
    <p class="fine">Baseline is the first 4 complete weeks (${esc(s.baseline_weeks[0])} to ${esc(s.baseline_weeks[3])}). Latest is the last 4 (${esc(s.latest_weeks[0])} to ${esc(s.latest_weeks[3])}). Weeks group tickets by the day they were created; the partial first and last weeks are left out. Each week has only about ${perWeek} escalations, so single weeks swing widely: judge changes on 4-week averages. Targets are assumptions to agree with Ritika. ${esc(s.caveat)}</p>`;
}
