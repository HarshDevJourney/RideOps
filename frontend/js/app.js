import { api } from './api.js';
import { closeDrawer } from './drawer.js';
import { errorState, esc } from './ui.js';
import agentsView from './views/agents.js';
import backlogView from './views/backlog.js';
import backtestView from './views/backtest.js';
import clientsView from './views/clients.js';
import escalationsView from './views/escalations.js';
import overviewView from './views/overview.js';
import queueView from './views/queue.js';
import successView from './views/success.js';
import tryView from './views/try.js';

const ROUTES = {
  overview: ['Overview', overviewView], queue: ['Open queue', queueView], try: ['Try a ticket', tryView],
  backlog: ['Backlog', backlogView], escalations: ['Escalations', escalationsView], agents: ['Agents', agentsView],
  clients: ['Clients', clientsView], success: ['Success measure', successView], backtest: ['Backtest', backtestView],
};
const view = document.getElementById('view');
let meta;

async function render() {
  const key = ROUTES[location.hash.slice(1)] ? location.hash.slice(1) : 'overview';
  closeDrawer();
  document.onkeydown = null;
  document.querySelectorAll('.nav a').forEach((a) => {
    const on = a.dataset.route === key;
    a.classList.toggle('active', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  document.getElementById('topTitle').textContent = ROUTES[key][0];
  document.title = `${ROUTES[key][0]} · RideOps Triage`;
  window.scrollTo(0, 0);
  await ROUTES[key][1](view, meta);
  view.focus({ preventScroll: true });
}

(async () => {
  try {
    meta = await api.get('/meta');
    document.getElementById('asOf').textContent = 'Data as of ' + new Date(meta.as_of).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('tickets').textContent = `${meta.tickets.toLocaleString('en-US')} tickets`;
    document.getElementById('navCount').textContent = meta.open;
    window.addEventListener('hashchange', render);
    render();
  } catch (e) { view.innerHTML = errorState(esc(e.message)); }
})();
