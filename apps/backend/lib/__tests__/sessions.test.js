import { describe, expect, it } from 'vitest';

import {
  CURRENT_SESSION_REF,
  DEFAULT_SESSION,
  ensureCurrentSession,
  newSessionId,
  queryParam,
  resolveSessionId,
  sanitizeKey,
  sessionBase,
  sessionCompletedRef,
  sessionDeviceRef,
  sessionEndRef,
  sessionProcessedRef,
  sessionScannedRef,
  sessionStartRef,
  sessionStateRef,
  toCounts,
  toSessionEntry,
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

describe('newSessionId', () => {
  it('builds salon_<fecha>_<hora> in Lima time, not UTC', () => {
    // 02:30 UTC del día 21 son las 21:30 del día 20 en Lima (UTC-5).
    expect(newSessionId(new Date('2026-09-21T02:30:00Z'))).toBe('salon_2026-09-20_21-30');
  });

  it('is the same for every scan of the same minute', () => {
    const primera = new Date('2026-09-20T16:05:00Z');
    const ultima = new Date('2026-09-20T16:05:59Z');

    expect(newSessionId(primera)).toBe(newSessionId(ultima));
    expect(newSessionId(primera)).toBe('salon_2026-09-20_11-05');
  });
});

describe('session lifecycle paths', () => {
  it('builds the RTDB paths for the open session', () => {
    expect(sessionStateRef()).toBe('sesion_actual');
    expect(CURRENT_SESSION_REF).toBe('sesion_actual');
    expect(sessionStartRef('s1')).toBe('sessions/s1/inicio');
    expect(sessionEndRef('s1')).toBe('sessions/s1/fin');
  });
});

describe('toSessionEntry', () => {
  it('marks a session without fin as open', () => {
    expect(toSessionEntry('s1', { scanned: 30, completed: 28, inicio: 'i' })).toEqual({
      id: 's1',
      inicio: 'i',
      fin: null,
      abierta: true,
      scanned: 30,
      completed: 28,
      pending: 2,
    });
  });

  it('marks a closed session as not open and keeps its timestamps', () => {
    const entry = toSessionEntry('s1', { scanned: 1, completed: 1, inicio: 'i', fin: 'f' });

    expect(entry.abierta).toBe(false);
    expect(entry.fin).toBe('f');
  });

  it('handles an empty session node', () => {
    expect(toSessionEntry('s1', null)).toEqual({
      id: 's1',
      inicio: null,
      fin: null,
      abierta: true,
      scanned: 0,
      completed: 0,
      pending: 0,
    });
  });
});

describe('ensureCurrentSession', () => {
  function createFakeDb(initial = {}) {
    const store = { ...initial };

    return {
      store,
      ref: (path) => ({
        once: async () => ({ val: () => (path in store ? store[path] : null) }),
        set: async (value) => {
          store[path] = value;
        },
      }),
    };
  }

  it('creates the session on the first scan and stamps inicio', async () => {
    const db = createFakeDb();
    const now = new Date('2026-09-20T16:05:00Z');

    const result = await ensureCurrentSession(db, now);

    expect(result).toEqual({ id: 'salon_2026-09-20_11-05', created: true });
    expect(db.store[CURRENT_SESSION_REF]).toBe('salon_2026-09-20_11-05');
    expect(db.store[sessionStartRef('salon_2026-09-20_11-05')]).toBe('2026-09-20T16:05:00.000Z');
  });

  it('reuses the session that is already open', async () => {
    const db = createFakeDb({ [CURRENT_SESSION_REF]: 'salon_2026-09-20_11-05' });

    const result = await ensureCurrentSession(db, new Date('2026-09-20T16:20:00Z'));

    expect(result).toEqual({ id: 'salon_2026-09-20_11-05', created: false });
  });

  it('converges on one session when two scans arrive at once', async () => {
    const db = createFakeDb();
    const now = new Date('2026-09-20T16:05:10Z');

    const [uno, dos] = await Promise.all([
      ensureCurrentSession(db, now),
      ensureCurrentSession(db, now),
    ]);

    expect(uno.id).toBe(dos.id);
    expect(db.store[CURRENT_SESSION_REF]).toBe(uno.id);
  });

  it('creates a fresh session once the previous one was closed', async () => {
    const db = createFakeDb({ [CURRENT_SESSION_REF]: undefined });

    const result = await ensureCurrentSession(db, new Date('2026-09-20T16:45:00Z'));

    expect(result).toEqual({ id: 'salon_2026-09-20_11-45', created: true });
  });
});
