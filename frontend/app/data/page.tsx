import { DataClient } from '@/components/DataClient';
import { PageHead } from '@/components/ui';
import { getJSON } from '@/lib/server-api';
import type { DataStatus } from '@/lib/types';

export const metadata = { title: 'Add data' };

export default async function DataPage() {
  const status = await getJSON<DataStatus>('/data/status');
  return (
    <>
      <PageHead title="Add data" sub="Upload a CSV with more tickets, for example next month's export. Every page, the queue and the success measure update to include it." />
      <DataClient status={status} />
    </>
  );
}
