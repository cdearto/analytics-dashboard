import './setup.ts';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, insertHit, dayOf, type Hit } from '../lib/db.ts';
import { totals, daily, breakdown, periods, change } from '../lib/reports.ts';

const hit = (o: Partial<Hit>): Hit => ({
  ts: 0, day: '2026-11-10', type: 'pageview', name: '', path: '/', referrer: '', source: 'Direct', visitor: 'v1',
  device: 'Desktop', browser: 'Chrome', os: 'macOS', country: '', region: '', city: '', isBot: false, ...o,
});
beforeEach(() => getDb().exec('DELETE FROM hits'));

test('totals: visitors, conversions and rates; bots excluded', () => {
  insertHit(hit({ visitor: 'a' })); insertHit(hit({ visitor: 'a', path: '/pricing' })); insertHit(hit({ visitor: 'b' }));
  insertHit(hit({ visitor: 'a', type: 'event', name: 'signup' }));
  insertHit(hit({ visitor: 'b', type: 'event', name: 'learn_more' }));        // not a conversion
  insertHit(hit({ visitor: 'bot', isBot: true }));
  insertHit(hit({ visitor: 'c', day: '2026-11-01' }));                         // outside the range
  const t = totals('2026-11-05', '2026-11-10', ['signup', 'purchase']);
  assert.deepEqual(t, { pageviews: 3, visitors: 2, conversions: 1, conversionRate: 50, pagesPerVisitor: 1.5 });
  assert.deepEqual(totals('2026-11-05', '2026-11-10', []).conversions, 0, 'no conversion events configured');
});

test('daily fills empty days', () => {
  insertHit(hit({ day: '2026-11-08' })); insertHit(hit({ day: '2026-11-10', visitor: 'x' })); insertHit(hit({ day: '2026-11-10', visitor: 'y' }));
  assert.deepEqual(daily('2026-11-08', '2026-11-10').map((d) => [d.day, d.pageviews, d.visitors]),
    [['2026-11-08', 1, 1], ['2026-11-09', 0, 0], ['2026-11-10', 2, 2]]);
});

test('daily stays on calendar days across DST', () => {
  assert.deepEqual(daily('2026-10-31', '2026-11-02').map((d) => d.day), ['2026-10-31', '2026-11-01', '2026-11-02']);
});

test('breakdowns: sources exclude internal clicks, ordered by count', () => {
  insertHit(hit({ source: 'Google' })); insertHit(hit({ source: 'Google' })); insertHit(hit({ source: 'Internal' })); insertHit(hit({ source: 'Bing' }));
  assert.deepEqual(breakdown('sources', '2026-11-01', '2026-11-30'), [{ label: 'Google', count: 2 }, { label: 'Bing', count: 1 }]);
});

test('periods: same-length window before the current one', () => {
  const p = periods(7, new Date('2026-11-13T12:00:00'));
  assert.deepEqual(p, { current: { from: '2026-11-07', to: '2026-11-13' }, previous: { from: '2026-10-31', to: '2026-11-06' } });
  assert.equal(dayOf(new Date('2026-11-13T23:30:00')), '2026-11-13');
});

test('change', () => {
  assert.equal(change(110, 100), 10);
  assert.equal(change(50, 100), -50);
  assert.equal(change(5, 0), null);
});
