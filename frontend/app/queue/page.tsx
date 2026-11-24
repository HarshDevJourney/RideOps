import { QueueClient } from '@/components/QueueClient';
import { getJSON, getMeta } from '@/lib/server-api';
import type { QueueData } from '@/lib/types';

export const metadata = { title: 'Open queue' };

export default async function QueuePage() {
  const [data, meta] = await Promise.all([getJSON<QueueData>('/queue'), getMeta()]);
  return <QueueClient data={data} meta={meta} />;
}
