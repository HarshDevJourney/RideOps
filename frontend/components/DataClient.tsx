'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StatCard } from '@/components/ui';
import { api } from '@/lib/client-api';
import { fmtDate, monthLabel, num } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { DataStatus, UploadIssue, UploadReport } from '@/lib/types';

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

export function DataClient({ status }: { status: DataStatus }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [asOf, setAsOf] = useState('');
  const [report, setReport] = useState<UploadReport | null>(null);
  const [busy, setBusy] = useState(false);
  const query = (dry: boolean) => `/data/upload?dry_run=${dry}${asOf ? `&as_of=${asOf}` : ''}`;

  const pick = (f: File | null) => { setFile(f); setReport(null); };
  const check = async () => {
    if (!file) return;
    setBusy(true); setReport(null);
    try { setReport(await api.upload(query(true), file)); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const apply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r: UploadReport = await api.upload(query(false), file);
      toast(`Added ${r.new_tickets} new and replaced ${r.replaced_tickets} tickets`);
      setFile(null); setReport(null); setAsOf('');
      router.refresh();
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const reset = async () => {
    if (!window.confirm('Remove every uploaded ticket and go back to the original data?')) return;
    setBusy(true);
    try { await api.del('/data/upload'); toast('Back to the original data'); setReport(null); router.refresh(); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const template = () => {
    const a = Object.assign(document.createElement('a'), { download: 'tickets_template.csv', href: URL.createObjectURL(new Blob([status.columns.join(',') + '\n'], { type: 'text/csv' })) });
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="grid g4">
        <StatCard label="Tickets loaded" value={num(status.tickets)} sub={`${num(status.original_tickets)} original, ${num(status.uploaded_tickets)} uploaded`} />
        <StatCard label="Created from" value={fmtDate(status.first_date)} sub={`to ${fmtDate(status.last_created)}`} />
        <StatCard label="Data as of" value={fmtDate(status.as_of, false)} sub={status.as_of_is_manual ? 'Typed in by you' : 'Latest date found in the tickets'} />
        <StatCard label="Open tickets" value={num(status.open)} sub="On that date" />
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card form">
          <div className="card-h"><h3>1. Choose a file</h3></div>
          <label className="f">Ticket CSV
            <input className="in" type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0] ?? null)} /></label>
          <label className="f">Data pulled on (optional)
            <input className="in" type="date" value={asOf} onChange={(e) => { setAsOf(e.target.value); setReport(null); }} style={{ width: 'auto' }} /></label>
          <p className="fine">Leave the date empty to use the latest date found in the tickets. Set it if the export was pulled later, so ticket ages and open counts are right.</p>
          <div className="toolbar"><button className="btn primary" disabled={!file || busy} onClick={check}>Check file</button>
            <button className="btn" type="button" onClick={template}>Download template</button>
            {status.uploaded_tickets > 0 ? <button className="btn" disabled={busy} onClick={reset}>Remove uploaded data</button> : null}</div>
          <p className="fine">Needs these columns: {status.columns.join(', ')}. Tickets with a new ID are added. A ticket whose ID is already loaded is replaced, which is how an open ticket gets its close date. Nothing is saved until you press Add to the app.</p>
        </div>

        <div className="card"><div className="card-h"><h3>Tickets by month</h3></div>
          {status.months.map((m) => <div key={m.month} className="rowbar" style={{ gridTemplateColumns: '80px minmax(0,1fr) 60px' }}><b>{monthLabel(m.month)}</b>
            <div className="hb"><i style={{ width: `${(m.tickets / Math.max(...status.months.map((x) => x.tickets))) * 100}%` }} /></div><span className="num">{m.tickets}</span></div>)}
        </div>
      </div>

      {report ? (
        <>
          <h3 style={{ margin: '6px 0 0' }}>2. Review</h3>
          <div className={`callout ${report.ok ? 'good' : ''}`}><span>{report.ok
            ? <><b>The file is valid.</b> {report.new_tickets} new tickets and {report.replaced_tickets} that replace tickets already loaded, covering {fmtDate(report.file_from)} to {fmtDate(report.file_to)}.{report.warning_count ? ` ${report.warning_count} warning${report.warning_count > 1 ? 's' : ''} below.` : ''}</>
            : <><b>The file has {report.error_count} problem{report.error_count > 1 ? 's' : ''}.</b> Fix them in the file and check it again. Nothing was added.</>}</span>
            {report.ok ? <><span className="grow" /><button className="btn primary" disabled={busy} onClick={apply}>Add to the app</button></> : null}</div>
          <Issues title="Problems to fix" items={report.errors} total={report.error_count} tone="bad" />
          <Issues title="Warnings" items={report.warnings} total={report.warning_count} tone="warn" />
          {report.ok && report.after && report.before ? (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <div className="card"><div className="card-h"><h3>What changes</h3></div>
                <div className="kv"><span>Tickets</span><b>{num(report.before.tickets)} to {num(report.after.tickets)}</b>
                  <span>Data as of</span><b>{fmtDate(report.before.as_of, false)} to {fmtDate(report.after.as_of, false)}</b>
                  <span>Open tickets</span><b>{report.before.open} to {report.after.open}</b></div></div>
              <div className="card"><div className="card-h"><h3>Tickets by month after adding</h3></div>
                {report.months!.map((m) => <div key={m.month} className="rowbar" style={{ gridTemplateColumns: '80px minmax(0,1fr) 110px' }}><b>{monthLabel(m.month)}</b>
                  <div className="hb"><i style={{ width: `${(m.tickets / Math.max(...report.months!.map((x) => x.tickets))) * 100}%` }} /></div>
                  <span className="num">{m.tickets}{m.tickets !== m.was ? ` (+${m.tickets - m.was})` : ''}</span></div>)}</div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
