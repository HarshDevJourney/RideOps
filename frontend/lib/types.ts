// Shapes returned by the FastAPI backend. Kept loose on purpose: the backend is the source of truth.
export type Any = any;
export type Fmt = 'pct' | 'hours' | 'num';

export interface TagMeta { label: string; kind: 'fact' | 'prediction'; tone: string; help: string }
export interface Meta {
  as_of: string; tags: Record<string, TagMeta>; categories: string[]; required_info: Record<string, string[]>;
  default_split: string; split_min: string; split_max: string; tickets: number; open: number;
}
export interface Verdict {
  ticket_id: string; tags: string[]; action: string; reason: string; risk: number; hold_escalation: boolean;
  details: { missing_info?: string[]; info_gap_rate?: number; risk?: number; checklist?: string[]; similar?: Any };
}
export interface QueueItem {
  ticket_id: string; client: string; category: string; priority: string; description: string; agent: string; status: string;
  handoffs: number; reopens: number; age_days: number; eng_outcome: string | null; verdict: Verdict; feedback: { agree: boolean } | null;
}
export interface QueueData {
  items: QueueItem[]; tag_counts: Record<string, number>; age_histogram: number[];
  totals: { open: number; with_l1: number; with_engineering: number; hold: number; p1: number; l1_action: number };
}
