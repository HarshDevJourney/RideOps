'use client';
import { useEffect, useState } from 'react';

export function Toast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setMsg((e as CustomEvent).detail); clearTimeout(t); t = setTimeout(() => setMsg(''), 1800); };
    window.addEventListener('toast', on);
    return () => { window.removeEventListener('toast', on); clearTimeout(t); };
  }, []);
  return <div id="toast" className={`toast${msg ? ' on' : ''}`} role="status" aria-live="polite">{msg}</div>;
}
