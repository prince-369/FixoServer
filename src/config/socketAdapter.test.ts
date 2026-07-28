import { describe, it, expect, afterEach } from 'vitest';
import { resolveSocketAdapter } from '../socket';
import { parseStrictBooleanEnv } from './env';

/**
 * Phase 9 environment-resolution matrix for the Socket.IO Redis adapter.
 * `resolveSocketAdapter` is the pure decision function used by the socket bootstrap.
 */
describe('resolveSocketAdapter() — env matrix', () => {
  const URL = 'redis://host:6379';

  it('REDIS_URL absent, flag absent → disabled', () => {
    expect(resolveSocketAdapter('', undefined)).toBe('disabled');
    expect(resolveSocketAdapter(undefined, undefined)).toBe('disabled');
  });
  it('REDIS_URL present, flag absent → enabled (backward-compatible)', () => {
    expect(resolveSocketAdapter(URL, undefined)).toBe('enabled');
  });
  it('REDIS_URL present, flag false → disabled', () => {
    expect(resolveSocketAdapter(URL, false)).toBe('disabled');
  });
  it('REDIS_URL present, flag true → enabled', () => {
    expect(resolveSocketAdapter(URL, true)).toBe('enabled');
  });
  it('REDIS_URL absent, flag false → disabled', () => {
    expect(resolveSocketAdapter('', false)).toBe('disabled');
  });
  it('REDIS_URL absent, flag true → enabled-without-redis (warn + in-memory)', () => {
    expect(resolveSocketAdapter('', true)).toBe('enabled-without-redis');
  });
});

describe('parseStrictBooleanEnv() — strict "true"/"false" only', () => {
  const KEY = 'PHASE9_TEST_FLAG' as keyof NodeJS.ProcessEnv;
  afterEach(() => { delete (process.env as Record<string, string | undefined>)[KEY as string]; });

  it('absent / empty → undefined (backward-compatible)', () => {
    expect(parseStrictBooleanEnv(KEY)).toBeUndefined();
    process.env[KEY as string] = '   ';
    expect(parseStrictBooleanEnv(KEY)).toBeUndefined();
  });
  it('exact "true"/"false" → boolean', () => {
    process.env[KEY as string] = 'true';
    expect(parseStrictBooleanEnv(KEY)).toBe(true);
    process.env[KEY as string] = 'false';
    expect(parseStrictBooleanEnv(KEY)).toBe(false);
  });
  it('loose/invalid values throw a configuration error', () => {
    for (const bad of ['1', '0', 'yes', 'on', 'TRUE', 'False', 'enabled']) {
      process.env[KEY as string] = bad;
      expect(() => parseStrictBooleanEnv(KEY)).toThrow(/Expected exactly "true" or "false"/);
    }
  });
});
