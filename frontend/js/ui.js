const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENT[c]);
export const pct = (x, d = 0) => (x == null ? '–' : (x * 100).toFixed(d) + '%');
export const num = (x) => (x == null ? '–' : Number(x).toLocaleString('en-US'));

export function tagPill(tag, meta) {
  const m = meta.tags[tag] || { label: tag, tone: 'gray', kind: 'fact', help: '' };
  return `<span class="pill t-${m.tone}${m.kind === 'prediction' ? ' pred' : ''}" title="${esc(m.help)}"><i class="dot"></i>${esc(m.label)}</span>`;
}
export const priPill = (p) => `<span class="pill ${p === 'P1' ? 't-red' : p === 'P2' ? 't-amber' : 't-gray'}">${esc(p)}</span>`;
export const statusPill = (s) => (s.includes('Engineering')
  ? '<span class="pill t-blue">With engineering</span>'
  : s === 'Closed' ? '<span class="pill t-green">Closed</span>' : '<span class="pill t-amber">With L1</span>');

export const skeleton = (n = 4) => `<div class="grid g4">${'<div class="skel"></div>'.repeat(n)}</div><div class="skel" style="height:320px"></div>`;
export const errorState = (msg) => `<div class="card empty"><b>Couldn't load this page</b>${esc(msg)}. Check that the API is running, then reload.</div>`;

let timer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(timer);
  timer = setTimeout(() => t.classList.remove('on'), 1800);
}

export const statCard = ({ label, value, sub = '', chart = '', foot = null }) => `
  <div class="card"><div class="stat-l">${esc(label)}</div><div class="stat-n">${value}</div><div class="stat-s">${sub}</div>${chart}
  ${foot ? `<div class="stat-x"><span>${esc(foot[0])}</span><span>${esc(foot[1])}</span></div>` : ''}</div>`;

export const pageHead = (title, sub = '', right = '') => `<div class="page-h"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>`;

/** Format one measure value. fmt: pct | hours | num */
export const fmtVal = (fmt, v, d = 1) => (v == null ? '–' : fmt === 'pct' ? pct(v, d) : fmt === 'hours' ? `${Number(v).toFixed(1)}h` : Number(v).toFixed(fmt === 'num' && Math.abs(v) < 10 ? 1 : 0));

/** Change pill. better: 'lower' | 'higher'. Small moves count as flat. */
export function deltaPill(fmt, base, last, better) {
  if (base == null || last == null) return '';
  const diff = last - base, tiny = fmt === 'pct' ? 0.01 : fmt === 'hours' ? 1 : 0.1;
  const txt = fmt === 'pct' ? `${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)} pts` : fmt === 'hours' ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}h` : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`;
  if (Math.abs(diff) < tiny) return '<span class="delta flat">Flat</span>';
  return `<span class="delta ${(better === 'lower') === (diff < 0) ? 'good' : 'bad'}">${txt}</span>`;
}
