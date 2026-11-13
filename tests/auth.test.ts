import './setup.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, createSessionToken, isValidSessionToken, safeEqual } from '../lib/auth.ts';
import { overLimit, clearAttempts, getDb } from '../lib/db.ts';
import { csvCell } from '../lib/csv.ts';

test('password hashing', () => {
  const h = hashPassword('correct horse');
  assert.match(h, /^scrypt:[\w-]+:[\w-]+$/);
  assert.ok(!h.includes('$'), 'no $ (the .env loader would expand it)');
  assert.ok(verifyPassword('correct horse', h));
  assert.ok(!verifyPassword('wrong', h));
  assert.ok(!verifyPassword('correct horse', 'garbage'));
  assert.notEqual(hashPassword('same'), hashPassword('same'), 'salted');
});

test('session tokens expire and die with a password change', () => {
  process.env.ADMIN_PASSWORD_HASH = hashPassword('one');
  const { value } = createSessionToken();
  assert.ok(isValidSessionToken(value));
  assert.ok(!isValidSessionToken(value, Date.now() + 8 * 86400_000), 'expired after 7 days');
  assert.ok(!isValidSessionToken(value.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), 'tampered');
  assert.ok(!isValidSessionToken(`${Date.now() + 1e9}.${value.split('.')[1]}`), 'extended expiry');
  assert.ok(!isValidSessionToken(undefined));
  process.env.ADMIN_PASSWORD_HASH = hashPassword('two');
  assert.ok(!isValidSessionToken(value), 'password changed');
});

test('safeEqual', () => {
  assert.ok(safeEqual('admin', 'admin'));
  assert.ok(!safeEqual('admin', 'admin2'));
  assert.ok(!safeEqual('', 'a'));
});

test('limits count every attempt, per key and scope, and reset', () => {
  getDb().exec('DELETE FROM attempts');
  for (let i = 0; i < 10; i++) assert.equal(overLimit('login', '203.0.113.7', 10, 900), false, `attempt ${i + 1}`);
  assert.equal(overLimit('login', '203.0.113.7', 10, 900), true, 'the 11th is refused');
  assert.equal(overLimit('login', '198.51.100.1', 10, 900), false, 'other addresses unaffected');
  assert.equal(overLimit('track', '203.0.113.7', 10, 900), false, 'separate scope');
  clearAttempts('login', '203.0.113.7');
  assert.equal(overLimit('login', '203.0.113.7', 10, 900), false, 'cleared after a successful login');
  getDb().exec('UPDATE attempts SET ts = ts - 1000');
  for (let i = 0; i < 9; i++) overLimit('login', '198.51.100.1', 10, 900);
  assert.equal(overLimit('login', '198.51.100.1', 10, 900), false, 'old attempts fall out of the window');
});

test('CSV cells cannot become formulas', () => {
  for (const v of ['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)']) assert.ok(csvCell(v).replace(/^"/, '').startsWith("'"), v);
  assert.equal(csvCell('jane@example.com'), 'jane@example.com');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('=a,b'), `"'=a,b"`);
  assert.equal(csvCell(42), '42');
});
