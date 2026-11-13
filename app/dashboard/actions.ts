'use server';
// Server Actions get Next.js's built-in origin check, so no hand-rolled CSRF tokens are needed.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { config } from '@/lib/config.ts';
import { SESSION_COOKIE, createSessionToken, safeEqual, verifyPassword } from '@/lib/auth.ts';
import { clearAttempts, overLimit } from '@/lib/db.ts';
import { clientIp } from '@/lib/tracking.ts';

// The username comes back so the form can refill it (React resets forms after an action).
export type LoginState = { error: string; username?: string } | null;

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!config.passwordHash) return { error: 'No password is set yet. Run npm run setup first.' };
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const user = String(form.get('username') ?? '').trim();
  // Counted before the password is checked: 10 tries per address per 15 minutes.
  if (overLimit('login', ip, 10, 900)) return { error: 'Too many attempts. Try again in 15 minutes.', username: user };

  const password = String(form.get('password') ?? '');
  if (!safeEqual(user, config.adminUser) || !verifyPassword(password, config.passwordHash)) {
    return { error: 'Wrong username or password.', username: user };
  }
  clearAttempts('login', ip);
  const session = createSessionToken();
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true, sameSite: 'lax', path: '/', expires: session.expires,
    secure: requestHeaders.get('x-forwarded-proto') === 'https',   // HTTPS-only as soon as the site is served over HTTPS
  });
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/dashboard/login');
}
