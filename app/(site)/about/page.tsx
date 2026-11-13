import { ContactForm } from './ContactForm.tsx';

export const metadata = { title: 'About' };

export default function About() {
  return (
    <>
      <h1>About</h1>
      <p className="lead">A fictional company. The form below records a <code>contact</code> conversion when submitted (it doesn&apos;t send anything).</p>
      <div className="card narrow"><ContactForm /></div>
    </>
  );
}
