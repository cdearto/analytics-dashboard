import Link from 'next/link';

export default function Home() {
  return (
    <>
      <h1>The placeholder product<br />for your analytics demo.</h1>
      <p className="lead">Click around: pages, buttons, the form, the links in the footer. Each one shows up on the dashboard within a second, with no cookies and no third-party scripts.</p>
      <div className="btns">
        <Link className="btn" href="/pricing" data-track="signup">Start free trial</Link>
        <Link className="btn ghost" href="/about" data-track="learn_more">Learn more</Link>
      </div>
      <div className="grid">
        <div className="card"><h3>Fast</h3><p>A tiny beacon sent with sendBeacon, so it never delays a page.</p></div>
        <div className="card"><h3>Private</h3><p>No cookies, no fingerprinting, no raw IPs stored. Visitor IDs are keyed hashes that change daily.</p></div>
        <div className="card"><h3>Yours</h3><p>One SQLite file on your own server. Export to CSV anytime.</p></div>
      </div>
    </>
  );
}
