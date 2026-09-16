const { beforeEach, describe, expect, it, vi } = require('vitest');

const refMock = vi.fn();
const onceMock = vi.fn();
const databaseMock = { ref: refMock };

vi.mock('../../lib/firebase', () => ({
  getFirebaseDb: vi.fn(() => databaseMock),
}));

const getCounts = require('../get-counts');

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

describe('GET /api/get-counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns current counts on GET', async () => {
    const counts = { scanned: 10, completed: 7 };
    onceMock.mockResolvedValue({ val: () => counts });
    refMock.mockReturnValue({ once: onceMock });

    const req = { method: 'GET' };
    const res = createRes();

    await getCounts(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(counts);
  });

  it('returns default counts when Firebase has no data', async () => {
    onceMock.mockResolvedValue({ val: () => null });
    refMock.mockReturnValue({ once: onceMock });

    const req = { method: 'GET' };
    const res = createRes();

    await getCounts(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ scanned: 0, completed: 0 });
  });

  it('returns 405 for non-GET/OPTIONS methods', async () => {
    const req = { method: 'POST' };
    const res = createRes();

    await getCounts(req, res);

    expect(res.statusCode).toBe(405);
  });

  it('returns 204 for OPTIONS', async () => {
    const req = { method: 'OPTIONS' };
    const res = createRes();

    await getCounts(req, res);

    expect(res.statusCode).toBe(204);
  });
});
