// Dashboard queries. Bots are always excluded.
import { getDb, dayOf } from './db.ts';

export type Row = { label: string; count: number };
export type DayPoint = { day: string; pageviews: number; visitors: number; events: number };
export type Totals = { visitors: number; pageviews: number; conversions: number; conversionRate: number; pagesPerVisitor: number };
export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

const daysAgo = (n: number, from = new Date()) => {
  const d = new Date(from); d.setDate(d.getDate() - n); return dayOf(d);
};

/** Inclusive day range for "the last N days", and the same-length period before it. */
export function periods(range: Range, today = new Date()) {
  return {
    current: { from: daysAgo(range - 1, today), to: dayOf(today) },
    previous: { from: daysAgo(2 * range - 1, today), to: daysAgo(range, today) },
  };
}

export function totals(from: string, to: string, conversionEvents: string[]): Totals {
  const db = getDb();
  const visits = db.prepare(`SELECT COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors
    FROM hits WHERE type = 'pageview' AND is_bot = 0 AND day BETWEEN ? AND ?`).get(from, to) as { pageviews: number; visitors: number };
  const placeholders = conversionEvents.map(() => '?').join(',') || "''";
  const { conversions } = db.prepare(`SELECT COUNT(*) AS conversions FROM hits
    WHERE type = 'event' AND is_bot = 0 AND day BETWEEN ? AND ? AND name IN (${placeholders})`).get(from, to, ...conversionEvents) as { conversions: number };
  return {
    ...visits,
    conversions,
    conversionRate: visits.visitors ? (100 * conversions) / visits.visitors : 0,
    pagesPerVisitor: visits.visitors ? visits.pageviews / visits.visitors : 0,
  };
}

/** One point per day, including days with no traffic. */
export function daily(from: string, to: string): DayPoint[] {
  const rows = getDb().prepare(`SELECT day, SUM(type = 'pageview') AS pageviews,
      COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor END) AS visitors, SUM(type = 'event') AS events
    FROM hits WHERE is_bot = 0 AND day BETWEEN ? AND ? GROUP BY day`).all(from, to);
  const byDay = new Map(rows.map((r) => [String(r.day), { day: String(r.day), pageviews: Number(r.pageviews), visitors: Number(r.visitors), events: Number(r.events) }]));
  const out: DayPoint[] = [];
  for (const d = new Date(`${from}T12:00:00`); dayOf(d) <= to; d.setDate(d.getDate() + 1)) {
    const day = dayOf(d);
    out.push(byDay.get(day) ?? { day, pageviews: 0, visitors: 0, events: 0 });
  }
  return out;
}

// Each breakdown is a fixed query (no column names from user input).
const BREAKDOWNS = {
  pages:     `SELECT path AS label, COUNT(*) AS count FROM hits WHERE type = 'pageview' AND is_bot = 0 AND day BETWEEN ? AND ? GROUP BY path`,
  // Where visits came from, not clicks between your own pages.
  sources:   `SELECT source AS label, COUNT(*) AS count FROM hits WHERE type = 'pageview' AND is_bot = 0 AND source <> 'Internal' AND day BETWEEN ? AND ? GROUP BY source`,
  events:    `SELECT name AS label, COUNT(*) AS count FROM hits WHERE type = 'event' AND is_bot = 0 AND day BETWEEN ? AND ? GROUP BY name`,
  devices:   `SELECT device AS label, COUNT(*) AS count FROM hits WHERE type = 'pageview' AND is_bot = 0 AND day BETWEEN ? AND ? GROUP BY device`,
  browsers:  `SELECT browser AS label, COUNT(*) AS count FROM hits WHERE type = 'pageview' AND is_bot = 0 AND day BETWEEN ? AND ? GROUP BY browser`,
  countries: `SELECT country AS label, COUNT(DISTINCT visitor) AS count FROM hits WHERE type = 'pageview' AND is_bot = 0 AND country <> '' AND day BETWEEN ? AND ? GROUP BY country`,
  cities:    `SELECT city || CASE WHEN region <> '' THEN ', ' || region ELSE '' END AS label, COUNT(DISTINCT visitor) AS count
              FROM hits WHERE type = 'pageview' AND is_bot = 0 AND city <> '' AND day BETWEEN ? AND ? GROUP BY label`,
} as const;
export type Breakdown = keyof typeof BREAKDOWNS;

export function breakdown(kind: Breakdown, from: string, to: string, limit = 8): Row[] {
  return getDb().prepare(`${BREAKDOWNS[kind]} ORDER BY count DESC LIMIT ?`).all(from, to, limit)
    .map((r) => ({ label: String(r.label ?? ''), count: Number(r.count) }));
}

/** Percentage change, or null when there's nothing to compare against. */
export function change(now: number, before: number): number | null {
  return before === 0 ? null : Math.round((100 * (now - before)) / before);
}
