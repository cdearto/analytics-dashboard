import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { config } from '@/lib/config.ts';
import { isSignedIn } from '@/lib/session.ts';
import { LoginForm } from './LoginForm.tsx';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage() {
  if (await isSignedIn()) redirect('/dashboard');
  return (
    <main className="login">
      <div className="login-box">
        <h1>{config.siteName}</h1>
        <p className="dim">Analytics — sign in.</p>
        {!config.passwordHash && (
          <p className="notice">No password set yet. In the project folder run <code>npm run setup</code>, then restart.</p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
