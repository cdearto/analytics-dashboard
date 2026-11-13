// All configuration comes from environment variables (.env.local in development).
// Read lazily so tests can set process.env before calling in.

const env = (key: string, fallback = ''): string => process.env[key]?.trim() || fallback;

export const config = {
  get siteName() { return env('SITE_NAME', 'My Site'); },
  get siteUrl() { return env('SITE_URL', 'http://localhost:3000').replace(/\/+$/, ''); },
  get siteHost() {
    try { return new URL(this.siteUrl).hostname.toLowerCase(); } catch { return ''; }
  },
  get conversions(): string[] {
    return env('CONVERSION_EVENTS', 'signup,contact,email,phone,purchase,book')
      .split(',').map((s) => s.trim()).filter(Boolean);
  },
  get adminUser() { return env('ADMIN_USER', 'admin'); },
  get passwordHash() { return env('ADMIN_PASSWORD_HASH'); },
  get secret() {
    const s = env('APP_SECRET');
    if (s.length < 32) throw new Error('APP_SECRET must be set to at least 32 characters (run `npm run setup`).');
    return s;
  },
  get trustedProxies() { return Math.max(0, Number.parseInt(env('TRUSTED_PROXIES', '1'), 10) || 0); },
  get dataDir() { return env('DATA_DIR', `${process.cwd()}/data`); },
};
