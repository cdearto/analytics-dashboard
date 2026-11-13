// Fills the database with ~180 days of believable fake traffic: a growth trend,
// quieter weekends and a couple of spikes, so the dashboard and its
// period-over-period comparisons have something to show.
//   npm run seed              add demo traffic (refuses if there's data)
//   npm run seed -- --reset   delete all hits first
import { existsSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const { getDb, insertHit, dayOf } = await import('../lib/db.ts');

// Deterministic randomness, so every seed looks the same.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T extends string>(weights: Record<T, number>): T => {
  const entries = Object.entries(weights) as [T, number][];
  let r = rand() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) if ((r -= w) <= 0) return k;
  return entries[0][0];
};

const db = getDb();
if (process.argv.includes('--reset')) db.exec('DELETE FROM hits');
else if ((db.prepare('SELECT COUNT(*) AS n FROM hits').get() as { n: number }).n > 0) {
  console.log('There are already hits here. Use --reset to replace them.');
  process.exit(1);
}

const pages = { '/': 50, '/pricing': 22, '/about': 10, '/blog/launch': 8, '/blog/privacy-first-analytics': 6, '/docs/getting-started': 4 };
const sources = { Google: 38, Direct: 26, LinkedIn: 8, Instagram: 6, 'news.ycombinator.com': 5, DuckDuckGo: 4, Bing: 4, newsletter: 5, 'X / Twitter': 3, GitHub: 1 };
const referrers: Record<string, string> = {
  Google: 'https://www.google.com/', LinkedIn: 'https://www.linkedin.com/', Instagram: 'https://l.instagram.com/',
  'news.ycombinator.com': 'https://news.ycombinator.com/', DuckDuckGo: 'https://duckduckgo.com/', Bing: 'https://www.bing.com/',
  'X / Twitter': 'https://t.co/abc', GitHub: 'https://github.com/',
};
const devices = { Mobile: 58, Desktop: 38, Tablet: 4 };
const browsers = { Mobile: { Safari: 55, Chrome: 40, Other: 5 }, Desktop: { Chrome: 60, Safari: 18, Edge: 12, Firefox: 10 }, Tablet: { Safari: 80, Chrome: 20 } };
const systems = { Mobile: { iOS: 60, Android: 40 }, Desktop: { macOS: 45, Windows: 50, Linux: 5 }, Tablet: { iOS: 85, Android: 15 } };
const places: Record<string, number> = {
  'United States|California|Los Angeles': 14, 'United States|California|San Francisco': 8, 'United States|New York|New York': 12,
  'United States|Texas|Austin': 6, 'United States|Washington|Seattle': 5, 'United States|Illinois|Chicago': 5,
  'Canada|Ontario|Toronto': 6, 'United Kingdom|England|London': 9, 'Germany|Berlin|Berlin': 5, 'Netherlands|North Holland|Amsterdam': 3,
  'Australia|New South Wales|Sydney': 4, 'India|Karnataka|Bengaluru': 4, 'Brazil|São Paulo|São Paulo': 3, 'Japan|Tokyo|Tokyo': 3,
};
const events = { signup: 45, purchase: 15, contact: 25, email: 20, phone: 10, learn_more: 35, outbound: 25, linkedin: 15, github: 10, none: 800 };

let total = 0;
db.exec('BEGIN');
for (let d = 179; d >= 0; d--) {
  const day0 = new Date(); day0.setHours(0, 0, 0, 0); day0.setDate(day0.getDate() - d);
  let base = 18 + (179 - d) * 0.32;                       // steady growth
  if (day0.getDay() === 0 || day0.getDay() === 6) base *= 0.62;   // quieter weekends
  if (d === 41 || d === 40) base *= 3.2;                  // a launch-day spike
  if (d === 12) base *= 2.1;                              // a newsletter send
  const visitors = Math.max(1, Math.round(base * (0.85 + rand() * 0.3)));
  for (let v = 0; v < visitors; v++) {
    const device = pick(devices);
    const browser = pick(browsers[device] as Record<string, number>);
    const os = pick(systems[device] as Record<string, number>);
    const source = d === 12 && rand() < 0.5 ? 'newsletter' : (d === 41 || d === 40) && rand() < 0.66 ? 'news.ycombinator.com' : pick(sources);
    const [country, region, city] = pick(places).split('|');
    const visitor = `demo-${d}-${v}`;
    let ts = day0.getTime() / 1000 + int(7 * 3600, 23 * 3600);
    let path: string = pick(pages);
    const who = { visitor, device, browser, os, country, region, city, isBot: false, name: '' };
    const views = 1 + (rand() > 0.55 ? int(1, 4) : 0);
    for (let p = 0; p < views; p++) {
      insertHit({ ...who, ts, day: dayOf(new Date(ts * 1000)), type: 'pageview', path,
        referrer: p === 0 ? referrers[source] ?? '' : 'http://localhost:3000/', source: p === 0 ? source : 'Internal' });
      total++; ts += int(15, 240); path = pick(pages);
    }
    const ev = pick(events);
    if (ev !== 'none') { insertHit({ ...who, ts, day: dayOf(new Date(ts * 1000)), type: 'event', name: ev, path, referrer: '', source: 'Internal' }); total++; }
  }
  for (let b = 0; b < 5; b++) {   // a trickle of bots, which the dashboard filters out
    insertHit({ ts: day0.getTime() / 1000 + int(0, 86399), day: dayOf(day0), type: 'pageview', name: '', path: '/', referrer: '', source: 'Direct',
      visitor: `bot-${b}`, device: 'Desktop', browser: 'Other', os: 'Other', country: '', region: '', city: '', isBot: true });
  }
}
db.exec('COMMIT');
console.log(`Demo traffic added: ${total.toLocaleString('en-US')} hits over 180 days.`);
