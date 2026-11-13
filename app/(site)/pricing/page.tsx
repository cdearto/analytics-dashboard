export const metadata = { title: 'Pricing' };

export default function Pricing() {
  return (
    <>
      <h1>Pricing</h1>
      <p className="lead">Made-up plans for the demo. The buttons are tagged with <code>data-track</code>.</p>
      <div className="grid">
        <div className="card"><h3>Starter</h3><div className="price">$0</div><p>For trying things out.</p><a className="btn ghost" href="#" data-track="signup">Sign up</a></div>
        <div className="card"><h3>Pro</h3><div className="price">$12</div><p>For growing teams.</p><a className="btn" href="#" data-track="purchase">Buy Pro</a></div>
        <div className="card"><h3>Enterprise</h3><div className="price">Let&apos;s talk</div><p>For everything else.</p><a className="btn ghost" href="mailto:sales@example.com">Contact sales</a></div>
      </div>
    </>
  );
}
