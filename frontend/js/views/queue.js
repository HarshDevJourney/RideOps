import { api } from '../api.js';
import { miniBars } from '../charts.js';
import { openDrawer } from '../drawer.js';
import { errorState, esc, num, pageHead, priPill, skeleton, statCard, statusPill, tagPill, toast } from '../ui.js';

const TAG_ORDER = ['P1', 'BOUNCING', 'FIX_READY', 'LACK_OF_INFO', 'CONFIG_CHECK', 'DUPLICATE', 'REOPENED', 'REOPEN_RISK',
  'SIMILAR_TO_HISTORY', 'COLLECT_INFO_FIRST', 'HOW_TO', 'NOT_REPRODUCIBLE'];
const L1_TAGS = ['LACK_OF_INFO', 'CONFIG_CHECK', 'DUPLICATE', 'HOW_TO', 'NOT_REPRODUCIBLE', 'FIX_READY'];
const PRI = { P1: 0, P2: 1, P3: 2, P4: 3 };
const ageHist = (items) => { const h = Array(10).fill(0); items.forEach((i) => { h[Math.min(i.age_days, 9)] += 1; }); return h; };
const SORTS = { priority: (a, b) => PRI[a.priority] - PRI[b.priority], handoffs: (a, b) => a.handoffs - b.handoffs, age: (a, b) => a.age_days - b.age_days };

export default async function queueView(root, meta) {
  root.innerHTML = skeleton();
  let data;
  try { data = await api.get('/queue'); } catch (e) { root.innerHTML = errorState(e.message); return; }
  const { items, tag_counts: counts, totals } = data;
  const withTag = (t) => items.filter((i) => i.verdict.tags.includes(t));
  const needL1 = items.filter((i) => L1_TAGS.some((t) => i.verdict.tags.includes(t)));
  let filter = 'ALL', q = '', sort = null, cur = -1;

  root.innerHTML = `
    ${pageHead('Open queue', `The ${totals.open} tickets still open on 30 Sep, most urgent first. Open one to see what to do next.`,
      '<button class="btn" id="csv">Export CSV</button>')}
    <div class="grid g4">
      ${statCard({ label: 'Open tickets', value: num(totals.open), sub: `${totals.with_l1} with L1, ${totals.with_engineering} with engineering`, chart: miniBars(ageHist(items), 'Open tickets by age in days'), foot: ['today', '9+ days old'] })}
      ${statCard({ label: 'Waiting on L1 to act', value: num(totals.l1_action), sub: 'Engineering has already answered', chart: miniBars(ageHist(needL1), 'Tickets waiting on L1, by age'), foot: ['today', '9+ days old'] })}
      ${statCard({ label: 'Bouncing', value: num(counts.BOUNCING || 0), sub: 'Two or more handoffs', chart: miniBars(ageHist(withTag('BOUNCING')), 'Bouncing tickets by age'), foot: ['today', '9+ days old'] })}
      ${statCard({ label: 'Fix ready, waiting to close', value: num(counts.FIX_READY || 0), sub: 'Confirm with the client, then close', chart: miniBars(ageHist(withTag('FIX_READY')), 'Fix-ready tickets by age'), foot: ['today', '9+ days old'] })}
    </div>
    <div class="toolbar" id="chips"></div>
    <div class="toolbar"><span class="legend">Solid tags are read from the ticket data. Dashed tags are predictions from past tickets.</span>
      <label class="search"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Search ticket, client or issue" aria-label="Search tickets"><kbd>/</kbd></label></div>
    <div class="table-wrap"><table><thead><tr><th>Ticket</th><th>Issue</th>
      <th aria-sort="none"><button class="th-sort" data-s="priority">Priority <span></span></button></th><th>Status</th><th>Tags</th>
      <th aria-sort="none"><button class="th-sort" data-s="handoffs">Handoffs <span></span></button></th>
      <th aria-sort="none"><button class="th-sort" data-s="age">Age <span></span></button></th><th>What to do</th></tr></thead><tbody id="rows"></tbody></table></div>`;

  const chips = root.querySelector('#chips'), rows = root.querySelector('#rows'), search = root.querySelector('#q');
  const visible = () => {
    let list = items.filter((i) => (filter === 'ALL' || i.verdict.tags.includes(filter))
      && (!q || `${i.ticket_id} ${i.client} ${i.description} ${i.category}`.toLowerCase().includes(q)));
    if (sort) list = [...list].sort((a, b) => SORTS[sort.key](a, b) * sort.dir);
    return list;
  };
  const show = (list, idx) => {
    cur = idx;
    rows.querySelectorAll('tr.sel').forEach((r) => r.classList.remove('sel'));
    const row = rows.querySelector(`tr[data-id="${list[idx].ticket_id}"]`);
    row?.classList.add('sel'); row?.scrollIntoView({ block: 'nearest' });
    openDrawer(list[idx], meta, { pos: `${idx + 1} of ${list.length}`, prev: idx > 0 ? () => show(list, idx - 1) : null, next: idx < list.length - 1 ? () => show(list, idx + 1) : null });
  };

  const paint = () => {
    const tags = TAG_ORDER.filter((t) => counts[t]);
    chips.innerHTML = [['ALL', 'All open', items.length, false], ...tags.map((t) => [t, meta.tags[t].label, counts[t], meta.tags[t].kind === 'prediction'])]
      .map(([k, l, n, pred]) => `<button class="filter${pred ? ' pred' : ''}" data-f="${k}" aria-pressed="${filter === k}">${esc(l)} <em>${n}</em></button>`).join('');
    chips.querySelectorAll('.filter').forEach((b) => (b.onclick = () => { filter = b.dataset.f; paint(); }));
    root.querySelectorAll('.th-sort').forEach((b) => {
      const on = sort && sort.key === b.dataset.s;
      b.querySelector('span').textContent = on ? (sort.dir > 0 ? '↑' : '↓') : '';
      b.closest('th').setAttribute('aria-sort', on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none');
    });
    const list = visible();
    rows.innerHTML = list.length ? list.map((i) => {
      const t = i.verdict.tags;
      return `<tr tabindex="0" data-id="${esc(i.ticket_id)}" class="${i.priority === 'P1' ? 'p1' : ''}">
        <td class="cell-id"><b>${esc(i.ticket_id)}</b><small>${esc(i.client)}</small></td>
        <td class="cell-desc">${esc(i.description)}<small>${esc(i.category)}</small></td>
        <td>${priPill(i.priority)}</td><td>${statusPill(i.status)}</td>
        <td><div class="tags">${t.slice(0, 3).map((x) => tagPill(x, meta)).join('')}${t.length > 3 ? `<span class="pill t-gray" title="${esc(t.slice(3).map((x) => meta.tags[x].label).join(', '))}">+${t.length - 3}</span>` : ''}</div></td>
        <td class="num${i.handoffs >= 2 ? ' hot' : ''}">${i.handoffs}</td><td class="num">${i.age_days}d</td>
        <td><div class="cell-act">${esc(i.verdict.action)}</div></td></tr>`;
    }).join('') : `<tr><td colspan="8"><div class="empty"><b>No tickets match</b>Clear the search or pick another tag.</div></td></tr>`;
    rows.querySelectorAll('tr[data-id]').forEach((r, idx) => {
      r.onclick = () => show(list, idx);
      r.onkeydown = (e) => { if (e.key === 'Enter') show(list, idx); };
    });
  };

  root.querySelectorAll('.th-sort').forEach((b) => (b.onclick = () => {
    const key = b.dataset.s;
    sort = !sort || sort.key !== key ? { key, dir: -1 } : sort.dir === -1 ? { key, dir: 1 } : null;
    paint();
  }));
  search.oninput = (e) => { q = e.target.value.trim().toLowerCase(); paint(); };
  document.onkeydown = (e) => { if (e.key === '/' && document.activeElement !== search && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); search.focus(); } };
  root.querySelector('#csv').onclick = () => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['ticket_id', 'client', 'category', 'priority', 'status', 'tags', 'handoffs', 'age_days', 'action'];
    const lines = visible().map((i) => [i.ticket_id, i.client, i.category, i.priority, i.status, i.verdict.tags.join('|'), i.handoffs, i.age_days, i.verdict.action].map(cell).join(','));
    const a = Object.assign(document.createElement('a'), { download: 'open_queue.csv', href: URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })) });
    a.click(); URL.revokeObjectURL(a.href); toast(`Exported ${lines.length} tickets`);
  };
  paint();
}
