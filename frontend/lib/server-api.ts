import type { Any, Meta } from './types';

// Used by server components. BACKEND_URL is read at runtime (set it in docker-compose or .env.local).
const BASE = process.env.BACKEND_URL || 'http://localhost:8000';

export async function getJSON<T = Any>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, { cache: 'no-store' });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail; } catch { /* no JSON body */ }
    throw new Error(res.status === 503 && detail ? `NO_DATA: ${detail}` : `The API returned ${res.status} for ${path}`);
  }
  return res.json();
}

export const getMeta = () => getJSON<Meta>('/meta');
