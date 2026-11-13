import Link from 'next/link';
import { Tracker } from '@/components/Tracker.tsx';
import './site.css';

// A tiny fictional website with the tracker installed, so the dashboard has something to measure.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <Tracker />
      <p className="note">Demo site: every page view and click here is recorded. <Link href="/dashboard">Open the dashboard →</Link></p>
      <div className="wrap">
        <nav><Link className="logo" href="/">Acme Co.</Link><span><Link href="/pricing">Pricing</Link><Link href="/about">About</Link></span></nav>
        {children}
        <footer>
          <a href="mailto:hello@example.com">hello@example.com</a>
          <a href="tel:+15555550100">(555) 555-0100</a>
          <a href="https://www.instagram.com/" rel="noopener">Instagram</a>
          <a href="https://www.linkedin.com/" rel="noopener">LinkedIn</a>
          <a href="https://github.com/" rel="noopener">GitHub</a>
        </footer>
      </div>
    </div>
  );
}
