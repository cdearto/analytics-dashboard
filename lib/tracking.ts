// Turning a beacon request into a row: bot filter, user-agent parsing, traffic
// source, a cookieless daily visitor ID, the client IP, and location.
import { createHmac } from 'node:crypto';
import { config } from './config.ts';

const BOT = /bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebookexternalhit|preview|monitor|curl|wget|python|headless|lighthouse|pingdom|uptime|semrush|ahrefs|screaming/i;
export const isBot = (ua: string): boolean => ua === '' || BOT.test(ua);

export function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  const device = /iPad|Tablet/i.test(ua) ? 'Tablet' : /Mobi|Android|iPhone|iPod/i.test(ua) ? 'Mobile' : 'Desktop';
  const first = (pairs: [string, string][]) => pairs.find(([needle]) => ua.includes(needle))?.[1] ?? 'Other';
  return {
    device,
    // Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
    browser: first([['Edg', 'Edge'], ['OPR', 'Opera'], ['Chrome', 'Chrome'], ['Firefox', 'Firefox'], ['Safari', 'Safari']]),
    os: first([['iPhone', 'iOS'], ['iPad', 'iOS'], ['Android', 'Android'], ['Mac OS', 'macOS'], ['Windows', 'Windows'], ['Linux', 'Linux']]),
  };
}

// Matched against the referrer's hostname; first match wins.
const KNOWN_SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'], [/(^|\.)yahoo\./, 'Yahoo'],
  [/(^|\.)instagram\.com$/, 'Instagram'], [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)(facebook\.com|fb\.me)$/, 'Facebook'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X / Twitter'], [/(^|\.)reddit\.com$/, 'Reddit'], [/(^|\.)github\.com$/, 'GitHub'],
];

/** Where a visit came from: utm_source if given, else a friendly name for the referrer's host. */
export function trafficSource(referrer: string, utm: string, requestHost = ''): string {
  if (utm) return utm;
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { return 'Direct'; }
  const bare = (h: string) => h.replace(/^www\./, '');
  if ([config.siteHost, requestHost.split(':')[0].toLowerCase()].some((own) => own && bare(own) === bare(host))) return 'Internal';
  return KNOWN_SOURCES.find(([pattern]) => pattern.test(host))?.[1] ?? bare(host);
}

/** Cookieless visitor ID: changes every day, can't be reversed to an IP. */
export function visitorId(ip: string, ua: string, day: string): string {
  return createHmac('sha256', config.secret).update(`${ip}|${ua}|${day}`).digest('hex').slice(0, 24);
}

/**
 * The visitor's IP. Each reverse proxy in front of the app appends the address
 * it received the request from, so with N proxies the visitor is N entries from
 * the end; anything further left was sent by the client and is ignored.
 * (Next.js only fills the header in when it's missing, so with no proxy at all
 * it can't be trusted. Every real host has at least one, hence the default of 1.)
 */
export function clientIp(headers: Headers, trustedProxies = config.trustedProxies): string {
  const chain = (headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return chain[Math.max(0, chain.length - Math.max(1, trustedProxies))] ?? '';
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** Location from the hosting platform's geo headers (Vercel, Cloudflare). No outside lookups. */
export function geoFromHeaders(headers: Headers): { country: string; region: string; city: string } {
  const decode = (v: string | null) => { try { return decodeURIComponent(v ?? ''); } catch { return ''; } };
  const code = (headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry') ?? '').toUpperCase();
  let country = '';
  if (/^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1') {
    try { country = countryNames.of(code) ?? ''; } catch { country = ''; }
  }
  return { country, region: decode(headers.get('x-vercel-ip-country-region')), city: decode(headers.get('x-vercel-ip-city')) };
}
