'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card empty">
      <b>Couldn&apos;t load this page</b>
      The API did not answer. Check that the backend is running (<code>/api/health</code>), then try again.
      <div style={{ marginTop: 14 }}><button className="btn primary" onClick={reset}>Try again</button></div>
      <p className="fine" style={{ marginTop: 10 }}>{error.message}</p>
    </div>
  );
}
