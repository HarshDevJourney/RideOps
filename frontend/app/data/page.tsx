import { DataClient } from '@/components/DataClient';
import { PageHead } from '@/components/ui';
import { getJSON } from '@/lib/server-api';
import type { DataStatus } from '@/lib/types';

export const metadata = { title: 'Datasets' };

export default async function DataPage() {
  const status = await getJSON<DataStatus>('/data/status');
  return (
    <>
      <PageHead title="Datasets" sub="Choose which data every page analyses, and add more months by uploading a CSV. Each upload is saved as a file you can see and delete." />
      <DataClient status={status} />
    </>
  );
}
