import type { Metadata } from 'next';
import Link from 'next/link';
import { config } from '@/lib/config.ts';
import { requireAdmin } from '@/lib/session.ts';
import { RANGES, type Range, breakdown, change, daily, periods, totals } from '@/lib/reports.ts';
import { BarList } from '@/components/BarList.tsx';
import { DailyChart } from '@/components/DailyChart.tsx';
import { signOut } from './actions.ts';

export const metadata: Metadata = { title: 'Analytics', robots: { index: false } };

const EVENT_LABELS: Record<string, string> = {
  signup: 'Signups', contact: 'Contact form', email: 'Email clicks', phone: 'Phone clicks', purchase: 'Purchases',
  book: 'Booking clicks', outbound: 'Outbound links', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook',
  youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X', github: 'GitHub',
};
const humanize = (name: string) => (name.charAt(0).toUpperCase() + name.slice(1)).replace(/[_-]+/g, ' ');
const fmt = (n: number, digits = 0) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function Delta({ now, before }: { now: number; before: number }) {
  const pct = change(now, before);
  if (pct === null) return <span className="delta flat">{now > 0 ? 'new' : '—'}</span>;
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return <span className={`delta ${dir}`} title="vs. the previous period">{pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : ''}{Math.abs(pct)}%</span>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const asked = Number((await searchParams).range);
  const range: Range = RANGES.find((r) => r === asked) ?? 30;
  const { current, previous } = periods(range);
  const conv = config.conversions;
  const now = totals(current.from, current.to, conv);
  const before = totals(previous.from, previous.to, conv);
  const list = (kind: Parameters<typeof breakdown>[0], limit?: number) => breakdown(kind, current.from, current.to, limit);
  const events = list('events', 12).map((e) => ({ ...e, label: `${EVENT_LABELS[e.label] ?? humanize(e.label)}${conv.includes(e.label) ? ' ★' : ''}` }));

  const kpis = [
    { label: 'Visitors', value: fmt(now.visitors), now: now.visitors, before: before.visitors },
    { label: 'Pageviews', value: fmt(now.pageviews), now: now.pageviews, before: before.pageviews },
    { label: 'Conversions', value: fmt(now.conversions), now: now.conversions, before: before.conversions },
    { label: 'Conversion rate', value: `${fmt(now.conversionRate, 1)}%`, now: now.conversionRate, before: before.conversionRate },
    { label: 'Pages / visitor', value: fmt(now.pagesPerVisitor, 1), now: now.pagesPerVisitor, before: before.pagesPerVisitor },
  ];

  return (
    <main className="wrap">
      <header className="top">
        <h1 className="brand">{config.siteName}</h1>
        <form action={signOut} className="meta">Analytics · <button className="link">Sign out</button></form>
      </header>

      <div className="toolbar">
        <nav className="ranges" aria-label="Date range">
          {RANGES.map((r) => (
            <Link key={r} href={`/dashboard?range=${r}`} className={r === range ? 'on' : undefined}>Last {r} days</Link>
          ))}
        </nav>
        <a className="ghost" href={`/dashboard/export?range=${range}`}>Download CSV ↓</a>
      </div>

      <section className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="n">{k.value}</div>
            <div className="l"><span>{k.label}</span><Delta now={k.now} before={k.before} /></div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Pageviews per day</h2>
        <DailyChart points={daily(current.from, current.to)} />
      </section>

      <div className="grid">
        <section className="card"><h2>Top pages</h2><BarList rows={list('pages')} /></section>
        <section className="card"><h2>Traffic sources</h2><BarList rows={list('sources')} /></section>
        <section className="card">
          <h2>Events &amp; clicks</h2>
          <BarList rows={events} empty='No events yet. Add data-track="name" to links, buttons or forms.' />
          {events.length > 0 && <p className="muted">★ counts as a conversion</p>}
        </section>
        <section className="card">
          <h2>Devices</h2><BarList rows={list('devices', 5)} />
          <h2 className="spaced">Browsers</h2><BarList rows={list('browsers', 6)} />
        </section>
        <section className="card">
          <h2>Top cities</h2><BarList rows={list('cities', 10)} empty="Location comes from your host's geo headers (Vercel, Cloudflare)." />
          <p className="muted">Approximate. Unique visitors.</p>
        </section>
        <section className="card"><h2>Countries</h2><BarList rows={list('countries')} empty="No location data yet." /></section>
      </div>

      <p className="muted footnote">First-party · cookieless · bots excluded. Visitors are counted once per day per browser, by a keyed hash that changes daily.</p>
    </main>
  );
}
