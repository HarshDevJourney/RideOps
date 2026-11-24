import { esc, pct, tagPill } from './ui.js';
import { hbar } from './charts.js';

/** The advice panel for one ticket. Used by the queue drawer and the "Try a ticket" page. */
export function verdictHTML(item, meta, { feedback = true } = {}) {
  const v = item.verdict, d = v.details || {};
  const missing = (d.missing_info || []).length
    ? `<section><h4>Details to have ready</h4><ul class="todo">${d.missing_info.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></section>` : '';
  const s = d.similar;
  const outcomes = s ? Object.entries(s.outcomes || {}).sort((a, b) => b[1] - a[1]) : [];
  const similar = s ? `<section><h4>Similar earlier tickets</h4>
    <p>“${esc(s.example)}”</p>
    <p class="muted">${s.count} tickets, ${s.escalations} escalated, ${pct(s.fixed_rate)} of those were fixed. Match strength ${pct(s.similarity)}.</p>
    <div style="margin-top:8px">${outcomes.map(([o, n]) => `<div class="rowbar" style="grid-template-columns:minmax(0,1fr) 90px 28px;padding:5px 0"><span class="muted">${esc(o.replace(' - returned to L1', ''))}</span>${hbar(n, s.escalations, o === 'Fixed' ? 'green' : 'gray')}<span class="num">${n}</span></div>`).join('')}</div></section>` : '';
  const risk = d.risk != null ? `<section><h4>Chance this ticket gets reopened (predicted)</h4>
    <div class="rowbar" style="grid-template-columns:minmax(0,1fr) 48px;padding:0">${hbar(d.risk, 0.5, d.risk >= 0.2 ? 'red' : '')}<span class="num">${pct(d.risk)}</span></div>
    <h4 style="margin-top:14px">Before you close</h4><ul class="todo">${(d.checklist || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>` : '';
  const fb = item.feedback;
  return `<div class="v">
    <section class="action"><h4>What to do</h4><p>${esc(v.action)}</p></section>
    <section><h4>Why</h4><p class="muted">${esc(v.reason)}</p></section>
    <section><h4>Tags</h4>${v.tags.length ? v.tags.map((t) => `<div class="tagrow">${tagPill(t, meta)}<span>${esc(meta.tags[t].help)}</span><em>${meta.tags[t].kind === 'fact' ? 'Read from the ticket data' : 'Our prediction from past tickets'}</em></div>`).join('') : '<p class="muted">No warning signs in the data.</p>'}</section>
    ${missing}${similar}${risk}
    ${feedback ? `<div class="fb"><span>Is this advice right?</span>
      <button class="btn ${fb && fb.agree ? 'sel-yes' : ''}" data-fb="1">Agree</button>
      <button class="btn ${fb && !fb.agree ? 'sel-no' : ''}" data-fb="0">Disagree</button></div>` : ''}
  </div>`;
}
