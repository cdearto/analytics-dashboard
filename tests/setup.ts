// Shared test environment: a throwaway data folder and fixed settings.
// Imported first by every test file, before any lib module reads config.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

Object.assign(process.env, {
  DATA_DIR: mkdtempSync(join(tmpdir(), 'analytics-test-')),
  SITE_NAME: 'Acme Co.',
  SITE_URL: 'https://www.example.com',
  CONVERSION_EVENTS: 'signup,purchase',
  APP_SECRET: 'test-secret-test-secret-test-secret-0000',
  ADMIN_USER: 'admin',
});
