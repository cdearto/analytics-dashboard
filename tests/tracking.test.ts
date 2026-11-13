import './setup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBot, parseUserAgent, trafficSource, visitorId, clientIp, geoFromHeaders } from '../lib/tracking.ts';

const UAS: [string, string, [string, string, string]][] = [
  ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', ['Mobile', 'Safari', 'iOS']],
  ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36', ['Mobile', 'Chrome', 'Android']],
  ['iPad', 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', ['Tablet', 'Safari', 'iOS']],
  ['Mac Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15', ['Desktop', 'Safari', 'macOS']],
  ['Windows Edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Edg/124.0', ['Desktop', 'Edge', 'Windows']],
  ['Linux Firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0', ['Desktop', 'Firefox', 'Linux']],
];
for (const [name, ua, [device, browser, os]] of UAS) {
  test(`user agent: ${name}`, () => {
    assert.deepEqual(parseUserAgent(ua), { device, browser, os });
    assert.equal(isBot(ua), false);
  });
}

test('bots are flagged', () => {
  for (const ua of ['', 'Googlebot/2.1 (+http://www.google.com/bot.html)', 'curl/8.4.0', 'python-requests/2.31',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/124.0', 'facebookexternalhit/1.1', 'AhrefsBot/7.0']) {
    assert.equal(isBot(ua), true, ua || '(empty)');
  }
});

test('traffic sources', () => {
  assert.equal(trafficSource('', ''), 'Direct');
  assert.equal(trafficSource('not a url', ''), 'Direct');
  assert.equal(trafficSource('https://www.google.com/', 'newsletter'), 'newsletter', 'utm_source wins');
  assert.equal(trafficSource('https://www.google.co.uk/search?q=x', ''), 'Google');
  assert.equal(trafficSource('https://l.instagram.com/?u=x', ''), 'Instagram');
  assert.equal(trafficSource('https://t.co/abc', ''), 'X / Twitter');
  assert.equal(trafficSource('https://news.ycombinator.com/item?id=1', ''), 'news.ycombinator.com', 'unknown hosts are kept');
  assert.equal(trafficSource('https://www.example.org/post', ''), 'example.org', 'minus www.');
  assert.equal(trafficSource('https://notgoogle.example/', ''), 'notgoogle.example', 'no substring false positives');
});

test('your own site counts as internal, look-alikes do not', () => {
  assert.equal(trafficSource('https://www.example.com/pricing', ''), 'Internal', 'configured SITE_URL');
  assert.equal(trafficSource('https://example.com/', ''), 'Internal', 'with or without www.');
  assert.equal(trafficSource('http://localhost:3000/about', '', 'localhost:3000'), 'Internal', 'the host serving the request');
  assert.equal(trafficSource('https://example.com.evil.tld/', ''), 'example.com.evil.tld');
});

test('visitor id is stable for a day, changes daily, reveals nothing', () => {
  const a = visitorId('203.0.113.7', 'UA', '2026-11-13');
  assert.equal(a, visitorId('203.0.113.7', 'UA', '2026-11-13'));
  assert.notEqual(a, visitorId('203.0.113.7', 'UA', '2026-11-14'));
  assert.notEqual(a, visitorId('203.0.113.8', 'UA', '2026-11-13'));
  assert.match(a, /^[a-f0-9]{24}$/);
});

test('client IP: entries left of the trusted proxies are ignored', () => {
  const h = (xff: string) => new Headers({ 'x-forwarded-for': xff });
  assert.equal(clientIp(h('203.0.113.7'), 1), '203.0.113.7');
  assert.equal(clientIp(h('1.2.3.4, 203.0.113.7'), 1), '203.0.113.7', 'a forged entry from the client is ignored');
  assert.equal(clientIp(h('1.2.3.4, 198.51.100.9, 10.0.0.2'), 2), '198.51.100.9', 'CDN + load balancer');
  assert.equal(clientIp(h('198.51.100.9'), 3), '198.51.100.9', 'never walks past the start');
  assert.equal(clientIp(h('203.0.113.7'), 0), '203.0.113.7', 'no proxy: best effort');
  assert.equal(clientIp(new Headers(), 1), '');
});

test('location comes from platform headers only', () => {
  assert.deepEqual(geoFromHeaders(new Headers({ 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'CA', 'x-vercel-ip-city': 'San%20Francisco' })),
    { country: 'United States', region: 'CA', city: 'San Francisco' });
  assert.equal(geoFromHeaders(new Headers({ 'cf-ipcountry': 'de' })).country, 'Germany');
  assert.equal(geoFromHeaders(new Headers({ 'cf-ipcountry': 'XX' })).country, '', 'unknown');
  assert.deepEqual(geoFromHeaders(new Headers()), { country: '', region: '', city: '' });
});
