import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Toast } from '@/components/Toast';
import { TopBar } from '@/components/TopBar';
import { getJSON, getMeta } from '@/lib/server-api';
import type { DataStatus } from '@/lib/types';

export const metadata: Metadata = { title: { default: 'RideOps Triage', template: '%s · RideOps Triage' }, description: 'Support triage for RideOps L1 agents and leads' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const meta = await getMeta().catch(() => null);   // pages show their own error if the API is down
  const noData = meta ? false : await getJSON<DataStatus>('/data/status').then((d) => !d.current).catch(() => false);   // API is up but nothing is chosen
  return (
    <html lang="en">
      <body>
        <div className="app">
          <Sidebar open={meta?.open} />
          <div className="main">
            <TopBar asOf={meta?.as_of} tickets={meta?.tickets} datasets={meta?.datasets.length} noData={noData} />
            <main id="view" tabIndex={-1}>{children}</main>
          </div>
        </div>
        <Toast />
      </body>
    </html>
  );
}
