import { api } from '../api.js';
import { hbar } from '../charts.js';
import { errorState, esc, num, pct, statCard } from '../ui.js';

export default async function backtestView(root, meta) {
  root.innerHTML = `
    <div class="page-h"><div><h1>Backtest</h1><p>Would these rules have helped? The tool learns only from tickets before the date, then replays every escalation after it, with outcomes hidden.</p></div>
      <div class="toolbar"><label class="f" style="grid-auto-flow:column;align-items:center">Learn before<input id="split" class="in" type="date" value="${esc(meta.default_split)}" min="${esc(meta.split_min)}" max="${esc(meta.split_max)}" style="width:auto"></label>
      <button id="run" class="btn primary">Run backtest</button></div></div>
    <div id="out"></div>`;
  const out = root.querySelector('#out'), btn = root.querySelector('#run');

  const run = async () => {
    btn.disabled = true; out.innerHTML = '<div class="skel" style="height:240px"></div>';
    try {
      const r = await api.get(`/backtest?split=${root.querySelector('#split').value}`);
      const ok = r.beats_chance;
      out.innerHTML = `
        <div class="callout ${ok ? 'good' : ''}"><span><b>${ok ? 'Better than chance.' : 'Not better than chance yet.'}</b>
          Of the ${r.flagged} escalations the tool would have flagged, ${pct(r.precision)} were avoidable. Without the tool, ${pct(r.base_rate)} of all escalations were avoidable (lift ${r.lift}).
          ${ok ? '' : 'On this split, category and issue text did not predict avoidable escalations. The fact-based tags on the open queue do not depend on this result.'}</span></div>
        <div class="grid g4" style="margin-top:14px">
          ${statCard({ label: 'Escalations replayed', value: num(r.test_escalations), sub: `Learned from ${num(r.train_size)} earlier tickets` })}
          ${statCard({ label: 'Flagged to check first', value: num(r.flagged), sub: `${r.p1_never_blocked} P1 tickets were never blocked` })}
          ${statCard({ label: 'Avoidable and caught', value: num(r.caught), sub: `${pct(r.recall)} of ${r.avoidable_total} avoidable escalations` })}
          ${statCard({ label: 'Real fixes wrongly flagged', value: num(r.wrongly_flagged), sub: 'Cost: the agent collects info first' })}
        </div>
        <div class="grid g2" style="margin-top:14px">
          <div class="card"><div class="card-h"><h3>What the caught tickets turned out to be</h3></div>
            ${Object.entries(r.caught_by_outcome).map(([k, n]) => `<div class="rowbar" style="grid-template-columns:minmax(0,1fr) 120px 30px"><span>${esc(k.replace(' - returned to L1', ''))}</span>${hbar(n, r.caught)}<span class="num">${n}</span></div>`).join('') || '<p class="muted">Nothing caught.</p>'}
            <p class="legend" style="margin-top:8px">${esc(r.note)}</p></div>
          <div class="card"><div class="card-h"><h3>Where the tool flagged real fixes</h3></div>
            ${Object.entries(r.wrongly_flagged_by_category).map(([k, n]) => `<div class="rowbar" style="grid-template-columns:minmax(0,1fr) 120px 30px"><span>${esc(k)}</span>${hbar(n, r.wrongly_flagged, 'red')}<span class="num">${n}</span></div>`).join('') || '<p class="muted">None.</p>'}
            <p class="legend" style="margin-top:8px">Thresholds are fixed in config.py and were not adjusted after seeing this result.</p></div>
        </div>`;
    } catch (e) { out.innerHTML = errorState(e.message); }
    btn.disabled = false;
  };
  btn.onclick = run;
  run();
}
