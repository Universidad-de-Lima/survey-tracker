import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SESSION,
  queryParam,
  readSessionState,
  resolveSessionId,
  sanitizeKey,
  sessionBase,
  sessionCompletedRef,
  sessionGenerationRef,
  sessionScannedRef,
  toCounts,
} from '../sessions.js';

describe('sanitizeKey', () => {
  it('replaces the characters Firebase RTDB forbids in keys', () => {
    expect(sanitizeKey('resp.123#test$a[b]c/d')).toBe('resp_123_test_a_b_c_d');
  });

  it('stringifies non-string values', () => {
    expect(sanitizeKey(42)).toBe('42');
  });
});

describe('queryParam', () => {
  it('reads the value from req.query', () => {
    expect(queryParam({ query: { s: 'salon-1' } }, 's')).toBe('salon-1');
  });

  it('falls back to the url when req.query is missing', () => {
    expect(queryParam({ url: '/api/done?s=salon-2' }, 's')).toBe('salon-2');
  });

  it('returns undefined when the parameter is absent', () => {
    expect(queryParam({ query: {} }, 's')).toBeUndefined();
    expect(queryParam({}, 's')).toBeUndefined();
  });
});

describe('resolveSessionId', () => {
  it('defaults to the campaign session when nothing is given', () => {
    expect(resolveSessionId({})).toBe(DEFAULT_SESSION);
    expect(resolveSessionId({ query: {} })).toBe(DEFAULT_SESSION);
    expect(resolveSessionId({ query: { s: '   ' } })).toBe(DEFAULT_SESSION);
  });

  it('reads the session from the query', () => {
    expect(resolveSessionId({ query: { s: 'salon-302' } })).toBe('salon-302');
  });

  it('reads the session from the url when the query object is absent', () => {
    expect(resolveSessionId({ url: '/api/done?s=salon-401' })).toBe('salon-401');
  });

  it('sanitizes and truncates the session id', () => {
    expect(resolveSessionId({ query: { s: 'salon/2026.1#a' } })).toBe('salon_2026_1_a');
    expect(resolveSessionId({ query: { s: 'x'.repeat(120) } }).length).toBe(64);
  });
});

describe('session paths', () => {
  it('builds the RTDB paths for a session', () => {
    expect(sessionBase('s1')).toBe('sessions/s1');
    expect(sessionScannedRef('s1')).toBe('sessions/s1/scanned');
    expect(sessionCompletedRef('s1')).toBe('sessions/s1/completed');
  });
});

describe('toCounts', () => {
  it('computes pending from scanned and completed', () => {
    expect(toCounts({ scanned: 30, completed: 28 })).toEqual({
      scanned: 30,
      completed: 28,
      pending: 2,
    });
  });

  it('does not return NaN when only scanned exists', () => {
    expect(toCounts({ scanned: 3 })).toEqual({ scanned: 3, completed: 0, pending: 3 });
  });

  it('never returns a negative pending', () => {
    expect(toCounts({ scanned: 5, completed: 9 }).pending).toBe(0);
  });

  it('handles an empty session node', () => {
    expect(toCounts(null)).toEqual({ scanned: 0, completed: 0, pending: 0 });
    expect(toCounts(undefined)).toEqual({ scanned: 0, completed: 0, pending: 0 });
  });
});

describe('session generation', () => {
  it('builds the RTDB path of the generation', () => {
    expect(sessionGenerationRef('s1')).toBe('sessions/s1/generacion');
  });

  it('reads generation and counters from the session in one query', async () => {
    const db = {
      ref: () => ({
        once: async () => ({ val: () => ({ scanned: 30, completed: 28, generacion: 3 }) }),
      }),
    };

    await expect(readSessionState(db, 's1')).resolves.toEqual({
      generacion: 3,
      counts: { scanned: 30, completed: 28, pending: 2 },
    });
  });

  it('treats a session that was never reset as generation 0', async () => {
    const db = { ref: () => ({ once: async () => ({ val: () => null }) }) };

    await expect(readSessionState(db, 's1')).resolves.toEqual({
      generacion: 0,
      counts: { scanned: 0, completed: 0, pending: 0 },
    });
  });
});
