'use client';
import { FormEvent, useState } from 'react';
import { PriPill } from '@/components/ui';
import { VerdictPanel } from '@/components/VerdictPanel';
import { api } from '@/lib/client-api';
import { toast } from '@/lib/toast';
import type { Any, Meta } from '@/lib/types';

const EXAMPLES: [string, string][] = [
  ['Report export failing', 'Scheduled report email not received'],
  ['Live tracking / GPS incorrect', 'Tracking link not opening for security team'],
  ['Roster / booking not syncing', 'Booking cutoff changed but roster still uses old cutoff'],
];

export function TryForm({ meta }: { meta: Meta }) {
  const [category, setCategory] = useState(meta.categories[0]);
  const [priority, setPriority] = useState('P3');
  const [description, setDescription] = useState('');
  const [done, setDone] = useState<string[]>([]);
  const [result, setResult] = useState<Any>(null);
  const [busy, setBusy] = useState(false);

  const pick = (c: string) => { setCategory(c); setDone([]); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { setResult(await api.post('/triage', { category, priority, description, info_provided: done })); }
    catch (err) { toast((err as Error).message); }
    setBusy(false);
  };

  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <form className="card form" onSubmit={submit}>
        <div><span className="muted">Examples</span>
          <div className="examples" style={{ marginTop: 6 }}>{EXAMPLES.map(([c, d]) => <button key={d} type="button" className="filter" onClick={() => { pick(c); setDescription(d); }}>{d}</button>)}</div></div>
        <label className="f">Category<select className="in" value={category} onChange={(e) => pick(e.target.value)}>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="f">Priority<select className="in" value={priority} onChange={(e) => setPriority(e.target.value)}>{['P1', 'P2', 'P3', 'P4'].map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="f">What is the client reporting?<textarea className="in" required minLength={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in one line" /></label>
        <fieldset style={{ border: 0, padding: 0 }}><legend className="muted" style={{ marginBottom: 4 }}>Already collected</legend>
          {(meta.required_info[category] || []).map((f) => (
            <label key={f} className="check"><input type="checkbox" checked={done.includes(f)} onChange={(e) => setDone(e.target.checked ? [...done, f] : done.filter((x) => x !== f))} /><span>{f}</span></label>))}</fieldset>
        <div><button className="btn primary" type="submit" disabled={busy}>Check this ticket</button></div>
      </form>
      <div className="card">
        {result ? <><div className="card-h"><h3>Advice</h3><PriPill p={result.priority} /></div><VerdictPanel verdict={result.verdict} meta={meta} /></>
          : <div className="empty"><b>No result yet</b>Fill in the form and choose Check this ticket.</div>}
      </div>
    </div>
  );
}
