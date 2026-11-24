'use client';
import { useEffect, useState } from 'react';
import { Hbar } from '@/components/charts';
import { PageHead, StatCard } from '@/components/ui';
import { api } from '@/lib/client-api';
import { num, pct } from '@/lib/format';
import type { Any, Meta } from '@/lib/types';

export function BacktestClient({ meta }: { meta: Meta }) {
  const [split, setSplit] = useState(meta.default_split);
  const [r, setR] = useState<Any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (date = split) => {
    setBusy(true); setErr('');
    try { setR(await api.get(`/backtest?split=${date}`)); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  useEffect(() => { run(meta.default_split); /* run once on open */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHead title="Backtest" sub="Would these rules have helped? The tool learns only from tickets before the date, then replays every escalation after it, with outcomes hidden."
        right={<div className="toolbar"><label className="f" style={{ gridAutoFlow: 'column', alignItems: 'center' }}>Learn before
          <input className="in" type="date" value={split} min={meta.split_min} max={meta.split_max} onChange={(e) => setSplit(e.target.value)} style={{ width: 'auto' }} /></label>
          <button className="btn primary" disabled={busy} onClick={() => run()}>Run backtest</button></div>} />
      {err ? <div className="card empty"><b>Couldn&apos;t run the backtest</b>{err}</div> : null}
      {!r && !err ? <div className="skel" style={{ height: 240 }} /> : null}
      {r && !err ? (
        <>
          <div className={`callout ${r.beats_chance ? 'good' : ''}`}><span><b>{r.beats_chance ? 'Better than chance.' : 'Not better than chance yet.'}</b> Of the {r.flagged} escalations the tool would have flagged, {pct(r.precision)} were avoidable. Without the tool, {pct(r.base_rate)} of all escalations were avoidable (lift {r.lift}). {r.beats_chance ? '' : 'On this split, category and issue text did not predict avoidable escalations. The fact-based tags on the open queue do not depend on this result.'}</span></div>
          <div className="grid g4">
            <StatCard label="Escalations replayed" value={num(r.test_escalations)} sub={`Learned from ${num(r.train_size)} earlier tickets`} />
            <StatCard label="Flagged to check first" value={num(r.flagged)} sub={`${r.p1_never_blocked} P1 tickets were never blocked`} />
            <StatCard label="Avoidable and caught" value={num(r.caught)} sub={`${pct(r.recall)} of ${r.avoidable_total} avoidable escalations`} />
            <StatCard label="Real fixes wrongly flagged" value={num(r.wrongly_flagged)} sub="Cost: the agent collects info first" />
          </div>
          <div className="grid g2">
            <div className="card"><div className="card-h"><h3>What the caught tickets turned out to be</h3></div>
              {Object.entries(r.caught_by_outcome).map(([k, n]: Any) => <div key={k} className="rowbar" style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 30px' }}><span>{k.replace(' - returned to L1', '')}</span><Hbar value={n} max={r.caught} /><span className="num">{n}</span></div>)}
              <p className="fine" style={{ marginTop: 8 }}>{r.note}</p></div>
            <div className="card"><div className="card-h"><h3>Where the tool flagged real fixes</h3></div>
              {Object.entries(r.wrongly_flagged_by_category).map(([k, n]: Any) => <div key={k} className="rowbar" style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 30px' }}><span>{k}</span><Hbar value={n} max={r.wrongly_flagged} tone="red" /><span className="num">{n}</span></div>)}
              <p className="fine" style={{ marginTop: 8 }}>Thresholds are fixed in config.py and were not adjusted after seeing this result.</p></div>
          </div>
        </>
      ) : null}
    </>
  );
}
