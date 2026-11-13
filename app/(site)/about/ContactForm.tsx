'use client';
import { useState } from 'react';

export function ContactForm() {
  const [sent, setSent] = useState(false);
  if (sent) return <p><strong>Thanks!</strong> Check the dashboard.</p>;
  return (
    <form data-track="contact" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <textarea name="message" rows={3} placeholder="Message" />
      <button className="btn" type="submit">Send</button>
    </form>
  );
}
