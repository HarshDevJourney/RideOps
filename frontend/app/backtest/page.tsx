import { BacktestClient } from '@/components/BacktestClient';
import { getMeta } from '@/lib/server-api';

export const metadata = { title: 'Backtest' };

export default async function BacktestPage() {
  return <BacktestClient meta={await getMeta()} />;
}
