'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const I = (d: ReactNode) => <svg viewBox="0 0 24 24">{d}</svg>;
const GROUPS: { title: string; items: { href: string; label: string; icon: ReactNode }[] }[] = [
  { title: 'Work', items: [
    { href: '/queue', label: 'Open queue', icon: I(<path d="M4 6h16M4 12h16M4 18h10" />) },
    { href: '/try', label: 'Try a ticket', icon: I(<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 17v4M17 19h4" /></>) },
  ] },
  { title: 'Diagnose', items: [
    { href: '/', label: 'Overview', icon: I(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>) },
    { href: '/backlog', label: 'Backlog', icon: I(<path d="M3 20h18M6 16V9M11 16V5M16 16v-5M21 16V8" />) },
    { href: '/escalations', label: 'Escalations', icon: I(<path d="M7 17L17 7M9 7h8v8" />) },
    { href: '/agents', label: 'Agents', icon: I(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c1.8.8 3 2.6 3 5.6" /></>) },
    { href: '/clients', label: 'Clients', icon: I(<path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" />) },
  ] },
  { title: 'Measure', items: [
    { href: '/success', label: 'Success measure', icon: I(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12l5-5" /></>) },
    { href: '/backtest', label: 'Backtest', icon: I(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>) },
  ] },
  { title: 'Data', items: [
    { href: '/data', label: 'Add data', icon: I(<><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>) },
  ] },
];

export function Sidebar({ open }: { open?: number }) {
  const path = usePathname();
  return (
    <aside className="side" aria-label="Main navigation">
      <div className="brand">
        <span className="logo"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /></svg></span>
        <span className="brand-name">RideOps Triage</span>
      </div>
      <nav className="nav">
        {GROUPS.map((g) => (
          <div key={g.title} style={{ display: 'contents' }}>
            <p className="nav-h">{g.title}</p>
            {g.items.map((it) => {
              const on = it.href === '/' ? path === '/' : path.startsWith(it.href);
              return (
                <Link key={it.href} href={it.href} className={on ? 'active' : ''} aria-current={on ? 'page' : undefined}>
                  {it.icon}<span>{it.label}</span>{it.href === '/queue' && open != null ? <b className="badge">{open}</b> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="side-foot"><div className="who"><span className="avatar">L1</span><div><b>Support agent</b><small>Advice only, P1 never blocked</small></div></div></div>
    </aside>
  );
}
