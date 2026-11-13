// Creates .env.local: site details, login and secret.
//   npm run setup            interactive
//   npm run setup -- --demo  demo settings (login: demo / demo)
// Re-running keeps your answers as defaults; it's also how to change the password.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../lib/auth.ts';

const FILE = '.env.local';
const current: Record<string, string> = {};
if (existsSync(FILE)) {
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) current[m[1]] = m[2];
  }
}

const values: Record<string, string> = {
  SITE_NAME: 'My Site', SITE_URL: 'http://localhost:3000', TZ: 'America/Los_Angeles',
  CONVERSION_EVENTS: 'signup,contact,email,phone,purchase,book', ADMIN_USER: 'admin', TRUSTED_PROXIES: '1',
  ...current,
};
values.APP_SECRET ||= randomBytes(32).toString('hex');

if (process.argv.includes('--demo')) {
  Object.assign(values, { SITE_NAME: 'Acme Co.', ADMIN_USER: 'demo', ADMIN_PASSWORD_HASH: hashPassword('demo') });
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label: string, key: string) => {
    const answer = (await rl.question(`${label} [${values[key]}]: `)).trim();
    if (answer) values[key] = answer;
  };
  console.log('Analytics setup. Press Enter to keep the value in [brackets].\n');
  await ask('Site name', 'SITE_NAME');
  await ask("Site URL (so clicks between your own pages aren't counted as referrals)", 'SITE_URL');
  await ask('Time zone (days are counted in it)', 'TZ');
  if (!Intl.supportedValuesOf('timeZone').includes(values.TZ)) throw new Error(`Unknown time zone: ${values.TZ}`);
  await ask('Login username', 'ADMIN_USER');
  const password = (await rl.question(values.ADMIN_PASSWORD_HASH ? 'New password (blank = keep): ' : 'Password: ')).trim();
  rl.close();
  if (password) {
    if (password.length < 8) throw new Error('Use at least 8 characters.');
    values.ADMIN_PASSWORD_HASH = hashPassword(password);
  }
  if (!values.ADMIN_PASSWORD_HASH) throw new Error('A password is required.');
}

writeFileSync(FILE, Object.entries(values).map(([k, v]) => `${k}="${v}"`).join('\n') + '\n', { mode: 0o600 });
console.log(`\nSaved ${FILE}.${process.argv.includes('--demo') ? ' Sign in with demo / demo.' : ''}`);
console.log('Next: npm run dev, then open http://localhost:3000/dashboard');
