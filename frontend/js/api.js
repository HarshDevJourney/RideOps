async function call(path, opts) {
  const res = await fetch('/api' + path, opts);
  if (!res.ok) {
    let msg = 'Request failed';
    try { msg = (await res.json()).detail || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  get: (path) => call(path),
  post: (path, body) => call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
};
