'use client';
import { useEffect, useRef } from 'react';
import { PriPill, StatusPill } from '@/components/ui';
import { VerdictPanel } from '@/components/VerdictPanel';
import type { Meta, QueueItem } from '@/lib/types';

interface Props { item: QueueItem; meta: Meta; pos: string; onPrev: (() => void) | null; onNext: (() => void) | null; onClose: () => void; onVote: (agree: boolean) => void; busy: boolean }

export function Drawer({ item, meta, pos, onPrev, onNext, onClose, onVote, busy }: Props) {
  const ref = useRef<HTMLElement>(null);
  const handlers = useRef({ onPrev, onNext, onClose });
  handlers.current = { onPrev, onNext, onClose };

  useEffect(() => {   // keyboard: Esc closes, arrows move between tickets; focus returns to the row on close
    const opener = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handlers.current.onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); handlers.current.onNext?.(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); handlers.current.onPrev?.(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); opener?.focus?.(); };
  }, []);
  useEffect(() => { ref.current?.scrollTo(0, 0); }, [item.ticket_id]);

  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <aside ref={ref} className="drawer on" aria-label="Ticket detail" role="dialog" aria-modal="true">
        <div className="d-head"><div><h2>{item.ticket_id}</h2><p>{item.client}</p></div>
          <div className="d-nav"><span>{pos}</span>
            <button className="x" aria-label="Previous ticket" disabled={!onPrev} onClick={() => onPrev?.()}>‹</button>
            <button className="x" aria-label="Next ticket" disabled={!onNext} onClick={() => onNext?.()}>›</button>
            <button className="x" aria-label="Close ticket detail" onClick={onClose} autoFocus>✕</button></div></div>
        <div className="toolbar" style={{ marginBottom: 12 }}><PriPill p={item.priority} /><StatusPill s={item.status} /><span className="chip">{item.category}</span></div>
        <p>{item.description}</p>
        <p className="muted" style={{ marginTop: 6 }}>Agent {item.agent}, {item.age_days} days old, {item.handoffs} handoffs, {item.reopens} reopens</p>
        <VerdictPanel verdict={item.verdict} feedback={item.feedback} meta={meta} onVote={onVote} busy={busy} />
        <p className="fine" style={{ marginTop: 18 }}><kbd>↑</kbd> <kbd>↓</kbd> move between tickets, <kbd>Esc</kbd> closes</p>
      </aside>
    </>
  );
}
