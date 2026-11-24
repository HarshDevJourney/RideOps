'use client';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  if (error.message.includes('NO_DATA')) {
    return (
      <div className="card empty">
        <b>No ticket data is in use</b>
        Every dataset is switched off, or the files were removed. Choose at least one dataset to see this page.
        <div style={{ marginTop: 14 }}><Link className="btn primary" href="/data">Choose data</Link></div>
      </div>
    );
  }
  return (
    <div className="card empty">
      <b>Couldn&apos;t load this page</b>
      The API did not answer. Check that the backend is running (<code>/api/health</code>), then try again.
      <div style={{ marginTop: 14 }}><button className="btn primary" onClick={reset}>Try again</button></div>
      <p className="fine" style={{ marginTop: 10 }}>{error.message}</p>
    </div>
  );
}
