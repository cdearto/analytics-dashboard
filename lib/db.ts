import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { config } from './config.ts';

export type Hit = {
  ts: number; day: string; type: 'pageview' | 'event'; name: string; path: string;
  referrer: string; source: string; visitor: string;
  device: string; browser: string; os: string;
  country: string; region: string; city: string; isBot: boolean;
};

let db: DatabaseSync | undefined;

/** The single SQLite connection (Node's built-in driver). Creates the schema on first use. */
export function getDb(): DatabaseSync {
  if (db) return db;
  const dir = config.dataDir;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  db = new DatabaseSync(`${dir}/analytics.sqlite`);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS hits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, day TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
      path TEXT NOT NULL DEFAULT '', referrer TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '',
      visitor TEXT NOT NULL, device TEXT NOT NULL DEFAULT '', browser TEXT NOT NULL DEFAULT '', os TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
      is_bot INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_hits_day ON hits(day, type);
    -- One row per recent request, for login throttling and ingestion rate limits.
    CREATE TABLE IF NOT EXISTS attempts (scope TEXT NOT NULL, key TEXT NOT NULL, ts INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_attempts ON attempts(scope, key, ts);
  `);
  return db;
}

export function insertHit(h: Hit): void {
  getDb().prepare(`INSERT INTO hits (ts, day, type, name, path, referrer, source, visitor, device, browser, os, country, region, city, is_bot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(h.ts, h.day, h.type, h.name, h.path, h.referrer, h.source, h.visitor, h.device, h.browser, h.os, h.country, h.region, h.city, h.isBot ? 1 : 0);
}

/** Keep about 13 months of hits. Called occasionally from ingestion. */
export function pruneOldHits(now = Date.now()): void {
  getDb().prepare('DELETE FROM hits WHERE ts < ?').run(Math.floor(now / 1000) - 400 * 86400);
}

/**
 * Count one request for `scope` from `key` and report whether that key is now
 * over `limit` within `windowSec`. Counting first means a burst of parallel
 * requests can't all slip under the limit.
 */
export function overLimit(scope: string, key: string, limit: number, windowSec: number): boolean {
  const d = getDb();
  const now = Math.floor(Date.now() / 1000);
  d.prepare('INSERT INTO attempts (scope, key, ts) VALUES (?, ?, ?)').run(scope, key, now);
  if (Math.random() < 0.02) d.prepare('DELETE FROM attempts WHERE ts < ?').run(now - 86400);
  const row = d.prepare('SELECT COUNT(*) AS n FROM attempts WHERE scope = ? AND key = ? AND ts > ?').get(scope, key, now - windowSec) as { n: number };
  return row.n > limit;
}

export function clearAttempts(scope: string, key: string): void {
  getDb().prepare('DELETE FROM attempts WHERE scope = ? AND key = ?').run(scope, key);
}

/** Local calendar day (in process TZ) as YYYY-MM-DD. */
export function dayOf(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
