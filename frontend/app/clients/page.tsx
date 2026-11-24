import { Hbar } from '@/components/charts';
import { PageHead } from '@/components/ui';
import { pct } from '@/lib/format';
import { getJSON } from '@/lib/server-api';
import type { Any } from '@/lib/types';

export const metadata = { title: 'Clients' };

export default async function Clients() {
  const c: Any = await getJSON('/metrics/top-clients?n=10');
  const top3 = c.top.slice(0, 3).reduce((a: number, r: Any) => a + r.share, 0);
  return (
    <>
      <PageHead title="Clients" sub="Is one company responsible for a large share of escalations? If so, the fix is with that client, not with the process." />
      <div className={`callout ${c.alert ? '' : 'good'}`}><span>{c.alert
        ? <><b>Alert:</b> at least one client causes {pct(c.alert_share)} or more of all escalations.</>
        : <><b>No single client is the problem.</b> The top 3 clients cause only {pct(top3, 1)} of escalations, across {c.clients} clients. An alert fires above {pct(c.alert_share)} for one client.</>}</span></div>
      <div className="grid g2">
        <div className="card"><div className="card-h"><h3>Top 10 clients by escalations</h3></div>
          {c.top.map((r: Any) => <div key={r.client_id} className="rowbar"><div><b>{r.client_name}</b><div className="muted" style={{ fontSize: 12 }}>{r.escalated} of {r.tickets} tickets escalated</div></div><Hbar value={r.share} max={c.alert_share} tone={r.alert ? 'red' : ''} /><span className="num">{pct(r.share, 1)}</span></div>)}
          <p className="fine" style={{ marginTop: 8 }}>The bar is full at the {pct(c.alert_share)} alert line.</p></div>
        <div className="card"><div className="card-h"><h3>Worth watching</h3></div>
          {c.watch.length ? c.watch.map((r: Any) => <div key={r.client_id} className="rowbar" style={{ gridTemplateColumns: 'minmax(0,1fr) 70px' }}><div><b>{r.client_name}</b><div className="muted" style={{ fontSize: 12 }}>{r.escalated} of {r.tickets} tickets escalated</div></div><span className="num">{pct(r.rate)}</span></div>) : <p className="muted">No client stands out.</p>}
          <p className="fine" style={{ marginTop: 8 }}>Clients with 10 or more tickets where 60% or more were escalated, outside the top 10. Small numbers, so check before acting.</p></div>
      </div>
    </>
  );
}
