import { api } from '../api.js';
import { esc, priPill, toast } from '../ui.js';
import { verdictHTML } from '../verdict.js';

const EXAMPLES = [
  ['Report export failing', 'Scheduled report email not received'],
  ['Live tracking / GPS incorrect', 'Tracking link not opening for security team'],
  ['Roster / booking not syncing', 'Booking cutoff changed but roster still uses old cutoff'],
];

export default function tryView(root, meta) {
  root.innerHTML = `
    <div class="page-h"><div><h1>Try a ticket</h1><p>Type a new issue and tick what you have already collected. The tool tells you whether to escalate or check first.</p></div></div>
    <div class="grid g2" style="align-items:start">
      <form class="card form" id="f">
        <div><span class="muted">Examples</span><div class="examples" style="margin-top:6px">${EXAMPLES.map((e, i) => `<button type="button" class="filter" data-ex="${i}">${esc(e[1])}</button>`).join('')}</div></div>
        <label class="f">Category<select class="in" id="cat">${meta.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label class="f">Priority<select class="in" id="pri"><option>P1</option><option>P2</option><option selected>P3</option><option>P4</option></select></label>
        <label class="f">What is the client reporting?<textarea class="in" id="desc" required minlength="3" placeholder="Describe the issue in one line"></textarea></label>
        <fieldset style="border:0;padding:0"><legend class="muted" style="margin-bottom:4px">Already collected</legend><div id="info"></div></fieldset>
        <div><button class="btn primary" type="submit" id="go">Check this ticket</button></div>
      </form>
      <div class="card" id="res"><div class="empty"><b>No result yet</b>Fill in the form and choose Check this ticket.</div></div>
    </div>`;
  const $ = (s) => root.querySelector(s), cat = $('#cat');
  const paintInfo = () => { $('#info').innerHTML = (meta.required_info[cat.value] || []).map((f) => `<label class="check"><input type="checkbox" value="${esc(f)}"><span>${esc(f)}</span></label>`).join(''); };
  cat.onchange = paintInfo; paintInfo();
  root.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => { const [c, d] = EXAMPLES[b.dataset.ex]; cat.value = c; paintInfo(); $('#desc').value = d; }));

  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#go'); btn.disabled = true;
    try {
      const r = await api.post('/triage', { category: cat.value, priority: $('#pri').value, description: $('#desc').value,
        info_provided: [...root.querySelectorAll('#info input:checked')].map((i) => i.value) });
      $('#res').innerHTML = `<div class="card-h"><h3>Advice</h3>${priPill(r.priority)}</div>${verdictHTML(r, meta, { feedback: false })}`;
    } catch (err) { toast(err.message); }
    btn.disabled = false;
  };
}
