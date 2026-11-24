// Used by client components. Requests go to /api/* on this app, which Next.js proxies to the backend.
async function call(path: string, init?: RequestInit) {
  const res = await fetch('/api' + path, init);
  if (!res.ok) {
    let msg = 'Request failed';
    try { msg = (await res.json()).detail || msg; } catch { /* keep default */ }
    throw new Error(typeof msg === 'string' ? msg : 'Please check the form and try again.');
  }
  return res.json();
}

export const api = {
  get: (path: string) => call(path),
  post: (path: string, body: unknown) => call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
};
