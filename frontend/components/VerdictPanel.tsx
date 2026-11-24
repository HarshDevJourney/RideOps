import { Hbar } from '@/components/charts';
import { TagPill } from '@/components/ui';
import { pct } from '@/lib/format';
import type { Any, Meta, Verdict } from '@/lib/types';

/** The advice for one ticket. Used by the queue drawer and the "Try a ticket" page. */
export function VerdictPanel({ verdict: v, feedback, meta, onVote, busy }:
  { verdict: Verdict; feedback?: { agree: boolean } | null; meta: Meta; onVote?: (agree: boolean) => void; busy?: boolean }) {
  const d = v.details || {}, s = d.similar;
  const outcomes: [string, number][] = s ? Object.entries(s.outcomes || {}).sort((a: Any, b: Any) => b[1] - a[1]) as [string, number][] : [];
  return (
    <div className="v">
      <section className="action"><h4>What to do</h4><p>{v.action}</p></section>
      <section><h4>Why</h4><p className="muted">{v.reason}</p></section>
      <section><h4>Tags</h4>
        {v.tags.length ? v.tags.map((t) => (
          <div key={t} className="tagrow"><TagPill tag={t} meta={meta} /><span>{meta.tags[t].help}</span><em>{meta.tags[t].kind === 'fact' ? 'Read from the ticket data' : 'Our prediction from past tickets'}</em></div>
        )) : <p className="muted">No warning signs in the data.</p>}</section>
      {d.missing_info?.length ? <section><h4>Details to have ready</h4><ul className="todo">{d.missing_info.map((m) => <li key={m}>{m}</li>)}</ul></section> : null}
      {s ? (
        <section><h4>Similar earlier tickets</h4>
          <p>“{s.example}”</p>
          <p className="muted">{s.count} tickets, {s.escalations} escalated, {pct(s.fixed_rate)} of those were fixed. Match strength {pct(s.similarity)}.</p>
          <div style={{ marginTop: 8 }}>{outcomes.map(([o, n]) => (
            <div key={o} className="rowbar" style={{ gridTemplateColumns: 'minmax(0,1fr) 90px 28px', padding: '5px 0' }}><span className="muted">{o.replace(' - returned to L1', '')}</span><Hbar value={n} max={s.escalations} tone={o === 'Fixed' ? 'green' : 'gray'} /><span className="num">{n}</span></div>))}</div></section>
      ) : null}
      {d.risk != null ? (
        <section><h4>Chance this ticket gets reopened (predicted)</h4>
          <div className="rowbar" style={{ gridTemplateColumns: 'minmax(0,1fr) 48px', padding: 0 }}><Hbar value={d.risk} max={0.5} tone={d.risk >= 0.2 ? 'red' : ''} /><span className="num">{pct(d.risk)}</span></div>
          <h4 style={{ marginTop: 14 }}>Before you close</h4><ul className="todo">{(d.checklist || []).map((c) => <li key={c}>{c}</li>)}</ul></section>
      ) : null}
      {onVote ? (
        <div className="fb"><span>Is this advice right?</span>
          <button className={`btn ${feedback?.agree ? 'sel-yes' : ''}`} disabled={busy} onClick={() => onVote(true)}>Agree</button>
          <button className={`btn ${feedback && !feedback.agree ? 'sel-no' : ''}`} disabled={busy} onClick={() => onVote(false)}>Disagree</button></div>
      ) : null}
    </div>
  );
}
