import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbStore = { current: null };

vi.mock('../../lib/firebase.js', () => ({
  getFirebaseDb: () => dbStore.current,
}));

import resetCounts from '../reset-counts.js';

let setMock;
let onceMock;
let refMock;

beforeEach(() => {
  vi.clearAllMocks();
  setMock = vi.fn();
  onceMock = vi.fn();
  refMock = vi.fn();
  dbStore.current = { ref: (path) => ({ once: () => ({ val: () => onceMock() }), set: setMock }) };
});

function createRes() {
  return {
    statusCode: undefined,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };
}

describe('POST /api/reset-counts', () => {
  it('resets counts to zero and returns previous values', async () => {
    const previous = { scanned: 10, completed: 7 };
    onceMock.mockResolvedValue({ val: () => previous });
    setMock.mockResolvedValue();
    refMock.mockReturnValue({ once: onceMock, set: setMock });

    const req = { method: 'POST' };
    const res = createRes();

    await resetCounts(req, res);

    expect(setMock).toHaveBeenCalledWith({ scanned: 0, completed: 0 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: 'Contadores reseteados exitosamente.',
      previousCounts: { scanned: 10, completed: 7 },
    });
  });

  it('returns 405 for non-POST/OPTIONS methods', async () => {
    const req = { method: 'GET' };
    const res = createRes();

    await resetCounts(req, res);

    expect(res.statusCode).toBe(405);
  });
});