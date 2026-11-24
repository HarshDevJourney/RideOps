import Link from 'next/link';

export default function NotFound() {
  return <div className="card empty"><b>Page not found</b>That page does not exist. <Link href="/" className="more">Go to the overview</Link></div>;
}
