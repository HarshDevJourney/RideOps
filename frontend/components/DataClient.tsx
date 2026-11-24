'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui';
import { api } from '@/lib/client-api';
import { fmtDate, monthLabel, num } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { DataStatus, DataWindow, UploadIssue, UploadReport } from '@/lib/types';

const where = (i: UploadIssue) => (i.row ? `Row ${i.row}` : 'File') + (i.column ? `, ${i.column}` : '');

function Issues({ title, items, total, tone }: { title: string; items: UploadIssue[]; total: number; tone: 'bad' | 'warn' }) {
  if (!total) return null;
  return (
    <div className="card"><div className="card-h"><h3>{title} <small>({total})</small></h3></div>
      <div className="table-wrap plain"><table><tbody>
        {items.map((i, k) => <tr key={k} style={{ cursor: 'default' }}><td style={{ whiteSpace: 'nowrap' }}><span className={`pill ${tone === 'bad' ? 't-red' : 't-amber'}`}>{where(i)}</span></td><td>{i.message}</td></tr>)}
      </tbody></table></div>
      {total > items.length ? <p className="fine" style={{ marginTop: 8 }}>Showing the first {items.length} of {total}.</p> : null}
    </div>
  );
}

function Months({ months, was }: { months: { month: string; tickets: number; was?: number }[]; was?: boolean }) {
  const max = Math.max(1, ...months.map((x) => x.tickets));
  return <>{months.map((m) => (
    <div key={m.month} className="rowbar" style={{ gridTemplateColumns: `80px minmax(0,1fr) ${was ? 110 : 60}px` }}><b>{monthLabel(m.month)}</b>
      <div className="hb"><i style={{ width: `${(m.tickets / max) * 100}%` }} /></div>
      <span className="num">{m.tickets}{was && m.tickets !== m.was ? ` (+${m.tickets - (m.was ?? 0)})` : ''}</span></div>))}</>;
}

export function DataClient({ status }: { status: DataStatus }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<UploadReport | null>(null);
  const [asOf, setAsOf] = useState(status.as_of_setting ?? '');
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);       // changing the key empties the file picker
  const [pending, setPending] = useState<Record<string, boolean>>({});     // ticks shown at once, before the server answers
  const cur: DataWindow | null = status.current;
  useEffect(() => setPending({}), [status]);

  const run = async (job: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await job(); toast(done); router.refresh(); } catch (e) { toast((e as Error).message); setPending({}); }
    setBusy(false);
  };
  const toggle = (id: string, on: boolean) => {
    const selected = status.datasets.filter((d) => (d.id === id ? on : d.selected)).map((d) => d.id);
    setPending({ [id]: on });
    return run(() => api.put('/data/selection', { selected }), on ? 'Dataset switched on' : 'Dataset switched off');
  };
  const remove = (id: string) => {
    if (!window.confirm(`Delete ${id}? The file is removed from ${status.folder}.`)) return;
    return run(() => api.del(`/data/datasets/${encodeURIComponent(id)}`), `Deleted ${id}`);
  };
  const saveDate = (value: string) => run(() => api.put('/data/selection', { as_of: value || null }), value ? 'Date saved' : 'Using the date found in the tickets');

  const pick = (f: File | null) => { setFile(f); setReport(null); };
  const query = (dry: boolean) => `/data/upload?dry_run=${dry}&name=${encodeURIComponent(file?.name ?? 'tickets.csv')}`;
  const check = async () => {
    if (!file) return;
    setBusy(true); setReport(null);
    try { setReport(await api.upload(query(true), file)); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const add = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r: UploadReport = await api.upload(query(false), file);
      toast(`Saved as ${r.saved_as} and switched on`);
      setFile(null); setReport(null); setInputKey((k) => k + 1); router.refresh();
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const template = () => {
    const a = Object.assign(document.createElement('a'), { download: 'tickets_template.csv', href: URL.createObjectURL(new Blob([status.columns.join(',') + '\n'], { type: 'text/csv' })) });
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <>
      {cur ? (
        <div className="grid g4">
          <StatCard label="Tickets in use" value={num(cur.tickets)} sub={`${status.selected_count} of ${status.datasets.length} datasets switched on`} />
          <StatCard label="Created from" value={fmtDate(cur.first_date)} sub={`to ${fmtDate(cur.last_created)}`} />
          <StatCard label="Data as of" value={fmtDate(cur.as_of, false)} sub={cur.as_of_is_manual ? 'Typed in by you' : 'Latest date found in the tickets'} />
          <StatCard label="Open tickets" value={num(cur.open)} sub="On that date" />
        </div>
      ) : <div className="callout"><span><b>No data is in use.</b> Switch on at least one dataset below, or upload a CSV. The other pages need data.</span></div>}

      <div className="card">
        <div className="card-h"><h3>Datasets <small>tick the ones to analyse</small></h3></div>
        {status.datasets.length === 0 ? <p className="fine">No dataset found. Upload a CSV below, or put one in <code>{status.folder}</code>.</p> : (
          <div className="table-wrap plain"><table>
            <thead><tr><th></th><th>Dataset</th><th>Tickets</th><th>Created</th><th>Status</th><th></th></tr></thead>
            <tbody>{status.datasets.map((d) => (
              <tr key={d.id} style={{ cursor: 'default' }}>
                <td><input type="checkbox" aria-label={`Use ${d.name}`} checked={pending[d.id] ?? d.selected} disabled={busy || d.status === 'problem'} onChange={(e) => toggle(d.id, e.target.checked)} /></td>
                <td><b>{d.name}</b><div className="fine">{d.kind === 'original' ? 'Built in. July to September from the case study' : `File in ${status.folder}`}</div>
                  {d.status === 'problem' ? <div className="fine" style={{ color: 'var(--red, #f87171)' }}>{d.problems.join('. ')}</div> : null}</td>
                <td className="num">{d.status === 'ok' ? num(d.tickets) : '–'}</td>
                <td>{d.status === 'ok' ? `${fmtDate(d.first, false)} to ${fmtDate(d.last, false)}` : '–'}</td>
                <td><span className={`pill ${d.status === 'problem' ? 't-red' : (pending[d.id] ?? d.selected) ? 't-green' : 't-gray'}`}>{d.status === 'problem' ? 'Problem' : (pending[d.id] ?? d.selected) ? 'In use' : 'Not used'}</span></td>
                <td style={{ textAlign: 'right' }}>{d.kind === 'upload' ? <button className="btn" disabled={busy} onClick={() => remove(d.id)}>Delete</button> : null}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        <p className="fine" style={{ marginTop: 10 }}>
          Files live in <code>backend/{status.folder}</code>. Delete a file there and it is no longer used. A CSV you copy there shows up here.
          If two files have the same ticket ID, the newer file is used, so a later export can close tickets that were open before.</p>
        <div className="toolbar" style={{ marginTop: 10 }}>
          <label className="f" style={{ margin: 0 }}>Data pulled on (optional)
            <input className="in" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ width: 'auto' }} /></label>
          <button className="btn" disabled={busy || asOf === (status.as_of_setting ?? '')} onClick={() => saveDate(asOf)}>Save date</button>
          {status.as_of_setting ? <button className="btn" disabled={busy} onClick={() => { setAsOf(''); saveDate(''); }}>Use automatic</button> : null}
        </div>
        <p className="fine">Empty means the latest date found in the tickets. Set it if the export was pulled later, so ticket ages and open counts are right.</p>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card form">
          <div className="card-h"><h3>Add a file</h3></div>
          <label className="f">Ticket CSV
            <input key={inputKey} className="in" type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0] ?? null)} /></label>
          <div className="toolbar"><button className="btn primary" disabled={!file || busy} onClick={check}>Check file</button>
            <button className="btn" type="button" onClick={template}>Download template</button></div>
          <p className="fine">Same columns as the original: {status.columns.join(', ')}. Checking saves nothing. Adding saves the file in the folder above and switches it on.</p>
        </div>
        <div className="card"><div className="card-h"><h3>Tickets by month <small>in use</small></h3></div>
          {cur ? <Months months={cur.months} /> : <p className="fine">Nothing to show yet.</p>}
        </div>
      </div>

      {report ? (
        <>
          <h3 style={{ margin: '6px 0 0' }}>Review</h3>
          <div className={`callout ${report.ok ? 'good' : ''}`}><span>{report.ok
            ? <><b>The file is valid.</b> {report.new_tickets} new tickets and {report.replaced_tickets} that replace tickets already in use, covering {fmtDate(report.file_from)} to {fmtDate(report.file_to)}.{report.warning_count ? ` ${report.warning_count} warning${report.warning_count > 1 ? 's' : ''} below.` : ''}</>
            : <><b>The file has {report.error_count} problem{report.error_count > 1 ? 's' : ''}.</b> Fix them in the file and check it again. Nothing was saved.</>}</span>
            {report.ok ? <><span className="grow" /><button className="btn primary" disabled={busy} onClick={add}>Save and use</button></> : null}</div>
          <Issues title="Problems to fix" items={report.errors} total={report.error_count} tone="bad" />
          <Issues title="Warnings" items={report.warnings} total={report.warning_count} tone="warn" />
          {report.ok && report.after ? (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <div className="card"><div className="card-h"><h3>What changes</h3></div>
                <div className="kv"><span>Tickets</span><b>{report.before ? `${num(report.before.tickets)} to ` : ''}{num(report.after.tickets)}</b>
                  <span>Data as of</span><b>{report.before ? `${fmtDate(report.before.as_of, false)} to ` : ''}{fmtDate(report.after.as_of, false)}</b>
                  <span>Open tickets</span><b>{report.before ? `${report.before.open} to ` : ''}{report.after.open}</b></div></div>
              <div className="card"><div className="card-h"><h3>Tickets by month after adding</h3></div><Months months={report.months!} was /></div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
