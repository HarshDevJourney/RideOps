import { PageHead } from '@/components/ui';
import { TryForm } from '@/components/TryForm';
import { getMeta } from '@/lib/server-api';

export const metadata = { title: 'Try a ticket' };

export default async function TryPage() {
  const meta = await getMeta();
  return (
    <>
      <PageHead title="Try a ticket" sub="Type a new issue and tick what you have already collected. The tool tells you whether to escalate or check first." />
      <TryForm meta={meta} />
    </>
  );
}
