'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TITLES: Record<string, string> = { '/': 'Overview', '/queue': 'Open queue', '/try': 'Try a ticket', '/backlog': 'Backlog', '/escalations': 'Escalations', '/agents': 'Agents', '/clients': 'Clients', '/success': 'Success measure', '/backtest': 'Backtest', '/data': 'Datasets' };

export function TopBar({ asOf, tickets, datasets, noData }: { asOf?: string; tickets?: number; datasets?: number; noData?: boolean }) {
  const path = usePathname();
  return (
    <header className="top">
      <span className="chip chip-strong">{TITLES[path] ?? 'RideOps Triage'}</span>
      {asOf ? <span className="chip">Data as of {new Date(asOf).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span> : noData ? <Link className="chip" href="/data">No data in use. Choose a dataset</Link> : <span className="chip">API not reachable</span>}
      {tickets ? <Link className="chip" href="/data" title="Choose which data to analyse">{tickets.toLocaleString('en-US')} tickets{datasets ? ` · ${datasets} dataset${datasets > 1 ? 's' : ''}` : ''}</Link> : null}
      <span className="grow" />
      <a className="chip" href="/docs" target="_blank" rel="noopener noreferrer">API docs</a>
    </header>
  );
}
