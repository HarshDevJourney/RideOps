import type { ReactNode } from 'react';
import { deltaInfo } from '@/lib/format';
import type { Fmt, Meta } from '@/lib/types';

export function TagPill({ tag, meta }: { tag: string; meta: Meta }) {
  const m = meta.tags[tag] || { label: tag, tone: 'gray', kind: 'fact', help: '' };
  return <span className={`pill t-${m.tone}${m.kind === 'prediction' ? ' pred' : ''}`} title={m.help}><i className="dot" />{m.label}</span>;
}
export const PriPill = ({ p }: { p: string }) => <span className={`pill ${p === 'P1' ? 't-red' : p === 'P2' ? 't-amber' : 't-gray'}`}>{p}</span>;
export const StatusPill = ({ s }: { s: string }) => s.includes('Engineering') ? <span className="pill t-blue">With engineering</span> : s === 'Closed' ? <span className="pill t-green">Closed</span> : <span className="pill t-amber">With L1</span>;

export function PageHead({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return <div className="page-h"><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>{right}</div>;
}

export function StatCard({ label, value, sub = '', chart, foot }: { label: string; value: ReactNode; sub?: ReactNode; chart?: ReactNode; foot?: [string, string] }) {
  return (
    <div className="card">
      <div className="stat-l">{label}</div><div className="stat-n">{value}</div><div className="stat-s">{sub}</div>{chart}
      {foot ? <div className="stat-x"><span>{foot[0]}</span><span>{foot[1]}</span></div> : null}
    </div>
  );
}

export function Delta({ fmt, base, last, better }: { fmt: Fmt; base?: number | null; last?: number | null; better: 'lower' | 'higher' }) {
  const d = deltaInfo(fmt, base, last, better);
  return d ? <span className={`delta ${d.tone}`}>{d.text}</span> : null;
}

export const Skeleton = ({ cards = 4 }: { cards?: number }) => (
  <><div className="grid g4">{Array.from({ length: cards }, (_, i) => <div key={i} className="skel" />)}</div><div className="skel" style={{ height: 320 }} /></>
);
