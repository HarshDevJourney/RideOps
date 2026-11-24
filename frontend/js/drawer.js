import { api } from './api.js';
import { esc, priPill, statusPill, toast } from './ui.js';
import { verdictHTML } from './verdict.js';

const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
let lastFocus = null, nav = {};

export function closeDrawer() {
  drawer.classList.remove('on'); scrim.classList.remove('on');
  drawer.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('tr.sel').forEach((r) => r.classList.remove('sel'));
  nav = {};
  lastFocus?.focus();
}

/** nav: { pos: '3 of 48', prev: fn|null, next: fn|null } lets the agent step through the queue. */
export function openDrawer(item, meta, navigation = {}) {
  if (!drawer.classList.contains('on')) lastFocus = document.activeElement;
  nav = navigation;
  const paint = () => {
    drawer.innerHTML = `<div class="d-head"><div><h2>${esc(item.ticket_id)}</h2><p>${esc(item.client)}</p></div>
      <div class="d-nav">${nav.pos ? `<span>${esc(nav.pos)}</span>` : ''}
        <button class="x" data-nav="prev" aria-label="Previous ticket" ${nav.prev ? '' : 'disabled'}>‹</button>
        <button class="x" data-nav="next" aria-label="Next ticket" ${nav.next ? '' : 'disabled'}>›</button>
        <button class="x" data-close aria-label="Close ticket detail">✕</button></div></div>
      <div class="toolbar" style="margin-bottom:12px">${priPill(item.priority)}${statusPill(item.status)}<span class="chip">${esc(item.category)}</span></div>
      <p>${esc(item.description)}</p>
      <p class="muted" style="margin-top:6px">Agent ${esc(item.agent)}, ${item.age_days} days old, ${item.handoffs} handoffs, ${item.reopens} reopens</p>
      ${verdictHTML(item, meta)}
      <p class="fine" style="margin-top:18px"><kbd>↑</kbd> <kbd>↓</kbd> move between tickets, <kbd>Esc</kbd> closes</p>`;
    drawer.querySelector('[data-close]').onclick = closeDrawer;
    drawer.querySelector('[data-nav=prev]').onclick = () => nav.prev?.();
    drawer.querySelector('[data-nav=next]').onclick = () => nav.next?.();
    drawer.querySelectorAll('[data-fb]').forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try { item.feedback = await api.post('/feedback', { ticket_id: item.ticket_id, agree: b.dataset.fb === '1' }); toast('Feedback saved'); }
      catch (e) { toast(e.message); }
      paint();
    }));
  };
  paint();
  drawer.scrollTop = 0;
  drawer.classList.add('on'); scrim.classList.add('on');
  drawer.setAttribute('aria-hidden', 'false');
}

scrim.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  if (!drawer.classList.contains('on')) return;
  if (e.key === 'Escape') closeDrawer();
  if (e.key === 'ArrowDown') { e.preventDefault(); nav.next?.(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); nav.prev?.(); }
});
