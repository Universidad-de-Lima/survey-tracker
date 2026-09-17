import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SESSION,
  resolveSessionId,
  sanitizeKey,
  sessionBase,
  sessionCompletedRef,
  sessionDeviceRef,
  sessionProcessedRef,
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

describe('resolveSessionId', () => {
  it('defaults to the default session when nothing is given', () => {
    expect(resolveSessionId({})).toBe(DEFAULT_SESSION);
    expect(resolveSessionId({ query: {} })).toBe(DEFAULT_SESSION);
  });

  it('reads the session from the query', () => {
    expect(resolveSessionId({ query: { s: 'salon-302' } })).toBe('salon-302');
  });

  it('reads the session from the url when the query object is absent', () => {
    expect(resolveSessionId({ url: '/api/qr-scan?s=salon-401&d=dev-1' })).toBe('salon-401');
  });

  it('reads the session from the body (webhook)', () => {
    expect(resolveSessionId({ body: { session: 'salon-500' } })).toBe('salon-500');
  });

  it('sanitizes and truncates the session id', () => {
    expect(resolveSessionId({ query: { s: 'salon/2026.1#a' } })).toBe('salon_2026_1_a');
    expect(resolveSessionId({ query: { s: 'x'.repeat(120) } }).length).toBe(64);
  });

  it('treats a blank session as the default one', () => {
    expect(resolveSessionId({ query: { s: '   ' } })).toBe(DEFAULT_SESSION);
  });
});

describe('session paths', () => {
  it('builds the RTDB paths for a session', () => {
    expect(sessionBase('s1')).toBe('sessions/s1');
    expect(sessionScannedRef('s1')).toBe('sessions/s1/scanned');
    expect(sessionCompletedRef('s1')).toBe('sessions/s1/completed');
    expect(sessionDeviceRef('s1', 'dev.1')).toBe('sessions/s1/devices/dev_1');
    expect(sessionProcessedRef('s1', 'resp#1')).toBe('sessions/s1/processed/resp_1');
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
