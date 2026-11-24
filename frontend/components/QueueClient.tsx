'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MiniBars } from '@/components/charts';
import { Drawer } from '@/components/Drawer';
import { PageHead, PriPill, StatCard, StatusPill, TagPill } from '@/components/ui';
import { api } from '@/lib/client-api';
import { fmtDate, num } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Meta, QueueData, QueueItem } from '@/lib/types';

const TAG_ORDER = ['P1', 'BOUNCING', 'FIX_READY', 'LACK_OF_INFO', 'CONFIG_CHECK', 'DUPLICATE', 'REOPENED', 'REOPEN_RISK', 'SIMILAR_TO_HISTORY', 'COLLECT_INFO_FIRST', 'HOW_TO', 'NOT_REPRODUCIBLE'];
const L1_TAGS = ['LACK_OF_INFO', 'CONFIG_CHECK', 'DUPLICATE', 'HOW_TO', 'NOT_REPRODUCIBLE', 'FIX_READY'];
const PRI: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
const SORTS: Record<string, (a: QueueItem, b: QueueItem) => number> = {
  priority: (a, b) => PRI[a.priority] - PRI[b.priority], handoffs: (a, b) => a.handoffs - b.handoffs, age: (a, b) => a.age_days - b.age_days,
};
const ageHist = (items: QueueItem[]) => { const h = Array(10).fill(0); items.forEach((i) => { h[Math.min(i.age_days, 9)] += 1; }); return h as number[]; };
const hasTag = (i: QueueItem, t: string) => i.verdict.tags.includes(t);

export function QueueClient({ data, meta }: { data: QueueData; meta: Meta }) {
  const [items, setItems] = useState(data.items);
  const [filter, setFilter] = useState('ALL');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const { tag_counts: counts, totals } = data;

  const list = useMemo(() => {
    let out = items.filter((i) => (filter === 'ALL' || hasTag(i, filter)) && (!q || `${i.ticket_id} ${i.client} ${i.description} ${i.category}`.toLowerCase().includes(q)));
    if (sort) out = [...out].sort((a, b) => SORTS[sort.key](a, b) * sort.dir);
    return out;
  }, [items, filter, q, sort]);
  const idx = list.findIndex((i) => i.ticket_id === selId);
  const current = idx >= 0 ? list[idx] : null;

  useEffect(() => {   // "/" jumps to search, like most data tools
    const key = (e: KeyboardEvent) => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement)?.tagName)) { e.preventDefault(); search.current?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  useEffect(() => { if (selId) document.querySelector(`tr[data-id="${selId}"]`)?.scrollIntoView({ block: 'nearest' }); }, [selId]);

  const vote = async (agree: boolean) => {
    if (!current) return;
    setBusy(true);
    try {
      const fb = await api.post('/feedback', { ticket_id: current.ticket_id, agree });
      setItems((prev) => prev.map((i) => (i.ticket_id === current.ticket_id ? { ...i, feedback: fb } : i)));
      toast('Feedback saved');
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  const toggleSort = (key: string) => setSort((s) => (!s || s.key !== key ? { key, dir: -1 } : s.dir === -1 ? { key, dir: 1 } : null));
  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['ticket_id', 'client', 'category', 'priority', 'status', 'tags', 'handoffs', 'age_days', 'action'];
    const lines = list.map((i) => [i.ticket_id, i.client, i.category, i.priority, i.status, i.verdict.tags.join('|'), i.handoffs, i.age_days, i.verdict.action].map(cell).join(','));
    const a = Object.assign(document.createElement('a'), { download: 'open_queue.csv', href: URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })) });
    a.click(); URL.revokeObjectURL(a.href); toast(`Exported ${lines.length} tickets`);
  };

  const needL1 = items.filter((i) => L1_TAGS.some((t) => hasTag(i, t)));
  const withTag = (t: string) => items.filter((i) => hasTag(i, t));
  const foot: [string, string] = ['today', '9+ days old'];
  const sortHead = (key: string, label: string) => (
    <th aria-sort={sort?.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button className="th-sort" onClick={() => toggleSort(key)}>{label} <span>{sort?.key === key ? (sort.dir > 0 ? '↑' : '↓') : ''}</span></button></th>);

  return (
    <>
      <PageHead title="Open queue" sub={`The ${totals.open} tickets still open on ${fmtDate(meta.as_of, false)}, most urgent first. Open one to see what to do next.`} right={<button className="btn" onClick={exportCsv}>Export CSV</button>} />
      <div className="grid g4">
        <StatCard label="Open tickets" value={num(totals.open)} sub={`${totals.with_l1} with L1, ${totals.with_engineering} with engineering`} chart={<MiniBars values={ageHist(items)} label="Open tickets by age in days" />} foot={foot} />
        <StatCard label="Waiting on L1 to act" value={num(totals.l1_action)} sub="Engineering has already answered" chart={<MiniBars values={ageHist(needL1)} label="Tickets waiting on L1, by age" />} foot={foot} />
        <StatCard label="Bouncing" value={num(counts.BOUNCING || 0)} sub="Two or more handoffs" chart={<MiniBars values={ageHist(withTag('BOUNCING'))} label="Bouncing tickets by age" />} foot={foot} />
        <StatCard label="Fix ready, waiting to close" value={num(counts.FIX_READY || 0)} sub="Confirm with the client, then close" chart={<MiniBars values={ageHist(withTag('FIX_READY'))} label="Fix-ready tickets by age" />} foot={foot} />
      </div>
      <div className="toolbar">
        {[['ALL', 'All open', items.length, false] as const, ...TAG_ORDER.filter((t) => counts[t]).map((t) => [t, meta.tags[t].label, counts[t], meta.tags[t].kind === 'prediction'] as const)].map(([k, l, n, pred]) => (
          <button key={k} className={`filter${pred ? ' pred' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} <em>{n}</em></button>))}
      </div>
      <div className="toolbar"><span className="legend">Solid tags are read from the ticket data. Dashed tags are predictions from past tickets.</span>
        <label className="search"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input ref={search} type="search" placeholder="Search ticket, client or issue" aria-label="Search tickets" onChange={(e) => setQ(e.target.value.trim().toLowerCase())} /><kbd>/</kbd></label></div>
      <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Issue</th>{sortHead('priority', 'Priority')}<th>Status</th><th>Tags</th>{sortHead('handoffs', 'Handoffs')}{sortHead('age', 'Age')}<th>What to do</th></tr></thead>
        <tbody>
          {list.length ? list.map((i) => (
            <tr key={i.ticket_id} data-id={i.ticket_id} tabIndex={0} className={`${i.priority === 'P1' ? 'p1' : ''}${i.ticket_id === selId ? ' sel' : ''}`}
              onClick={() => setSelId(i.ticket_id)} onKeyDown={(e) => { if (e.key === 'Enter') setSelId(i.ticket_id); }}>
              <td className="cell-id"><b>{i.ticket_id}</b><small>{i.client}</small></td>
              <td className="cell-desc">{i.description}<small>{i.category}</small></td>
              <td><PriPill p={i.priority} /></td><td><StatusPill s={i.status} /></td>
              <td><div className="tags">{i.verdict.tags.slice(0, 3).map((t) => <TagPill key={t} tag={t} meta={meta} />)}
                {i.verdict.tags.length > 3 ? <span className="pill t-gray" title={i.verdict.tags.slice(3).map((x) => meta.tags[x].label).join(', ')}>+{i.verdict.tags.length - 3}</span> : null}</div></td>
              <td className={`num${i.handoffs >= 2 ? ' hot' : ''}`}>{i.handoffs}</td><td className="num">{i.age_days}d</td>
              <td><div className="cell-act">{i.verdict.action}</div></td></tr>
          )) : <tr><td colSpan={8}><div className="empty"><b>No tickets match</b>Clear the search or pick another tag.</div></td></tr>}
        </tbody></table></div>
      {current ? (
        <Drawer item={current} meta={meta} pos={`${idx + 1} of ${list.length}`} busy={busy} onVote={vote} onClose={() => setSelId(null)}
          onPrev={idx > 0 ? () => setSelId(list[idx - 1].ticket_id) : null} onNext={idx < list.length - 1 ? () => setSelId(list[idx + 1].ticket_id) : null} />
      ) : null}
    </>
  );
}
