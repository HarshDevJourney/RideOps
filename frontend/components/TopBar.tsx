'use client';
import { usePathname } from 'next/navigation';

const TITLES: Record<string, string> = { '/': 'Overview', '/queue': 'Open queue', '/try': 'Try a ticket', '/backlog': 'Backlog', '/escalations': 'Escalations', '/agents': 'Agents', '/clients': 'Clients', '/success': 'Success measure', '/backtest': 'Backtest', '/data': 'Add data' };

export function TopBar({ asOf, tickets }: { asOf?: string; tickets?: number }) {
  const path = usePathname();
  return (
    <header className="top">
      <span className="chip chip-strong">{TITLES[path] ?? 'RideOps Triage'}</span>
      {asOf ? <span className="chip">Data as of {new Date(asOf).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span> : <span className="chip">API not reachable</span>}
      {tickets ? <span className="chip">{tickets.toLocaleString('en-US')} tickets</span> : null}
      <span className="grow" />
      <a className="chip" href="/docs" target="_blank" rel="noopener noreferrer">API docs</a>
    </header>
  );
}
