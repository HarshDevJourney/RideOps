import { esc } from './ui.js';

/** Small bar chart with the dashed "Avg" line and the tallest bar highlighted. */
export function miniBars(values, label = 'Bar chart') {
  const max = Math.max(...values) || 1;
  const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const top = values.indexOf(Math.max(...values));
  const bars = values.map((v, i) => `<i class="${i === top ? 'on' : ''}" style="height:${Math.max((v / max) * 100, 3)}%"></i>`).join('');
  return `<div class="bars" role="img" aria-label="${esc(label)}">${bars}<div class="avg" style="bottom:${(avg / max) * 100}%"><b>Avg</b></div></div>`;
}

/** Horizontal bar. tone: '' (amber), red, green, gray. */
export const hbar = (value, max, tone = '') => `<div class="hb ${tone}"><i style="width:${Math.min(100, (value / (max || 1)) * 100)}%"></i></div>`;

/** Created vs closed per week (bars) with open-at-week-end (line). */
export function weeklyChart(rows) {
  const W = 720, H = 250, L = 38, R = 10, T = 14, B = 30;
  const top = Math.ceil(Math.max(...rows.flatMap((r) => [r.created, r.closed, r.open_at_end])) / 20) * 20 || 20;
  const gw = (W - L - R) / rows.length, bw = Math.min(16, gw * 0.3);
  const y = (v) => T + (H - T - B) * (1 - v / top);
  let svg = '';
  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.07)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }
  rows.forEach((r, i) => {
    const gx = L + gw * i + gw / 2;
    svg += `<rect x="${gx - bw - 1}" y="${y(r.created)}" width="${bw}" height="${H - B - y(r.created)}" rx="2" fill="var(--amber)"/>`;
    svg += `<rect x="${gx + 1}" y="${y(r.closed)}" width="${bw}" height="${H - B - y(r.closed)}" rx="2" fill="#44444b"/>`;
    svg += `<text x="${gx}" y="${H - 10}" text-anchor="middle">${esc(r.week)}</text>`;
  });
  const pts = rows.map((r, i) => `${L + gw * i + gw / 2},${y(r.open_at_end)}`);
  svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`;
  pts.forEach((p) => { const [cx, cy] = p.split(','); svg += `<circle cx="${cx}" cy="${cy}" r="2.6" fill="#09090a" stroke="#fff" stroke-width="1.4"/>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tickets created and closed per week, with open tickets at week end">${svg}</svg>`;
}

/** Line chart over weeks. points: [{label, y}]. Optional dashed baseline and target lines. */
export function lineChart(points, { fmt = (v) => v, baseline = null, target = null, h = 170 } = {}) {
  const W = 460, H = h, L = 46, R = 14, T = 14, B = 26;
  const vals = [...points.map((p) => p.y), baseline, target].filter((v) => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.18 || 0.05;
  const yMin = lo >= 0 ? Math.max(0, lo - pad) : lo - pad, yMax = hi + pad;
  const y = (v) => T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin));
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
  let svg = '';
  for (let i = 0; i <= 3; i++) {
    const v = yMin + ((yMax - yMin) / 3) * i;
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.07)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  const ref = (v, color, label) => (v == null ? '' : `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${color}" stroke-dasharray="5 4" stroke-width="1.2"/><text x="${W - R}" y="${y(v) - 5}" text-anchor="end" style="fill:${color}">${label}</text>`);
  svg += ref(baseline, '#b8b8c0', 'Baseline') + ref(target, '#4ade80', 'Target');
  svg += `<polyline points="${points.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  points.forEach((p, i) => { svg += `<circle cx="${x(i)}" cy="${y(p.y)}" r="3.2" fill="#09090a" stroke="var(--amber2)" stroke-width="1.6"><title>${esc(p.label)}: ${esc(fmt(p.y))}</title></circle>`; });
  [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach((i, k) => { svg += `<text x="${x(i)}" y="${H - 7}" text-anchor="${k === 2 ? 'end' : k === 0 ? 'start' : 'middle'}">${esc(points[i].label)}</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly trend">${svg}</svg>`;
}
