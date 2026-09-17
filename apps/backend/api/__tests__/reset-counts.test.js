import { beforeEach, describe, expect, it, vi } from 'vitest';

let setMock;
let onceMock;
let transactionMock;
let removeMock;
let refMock;

// El endpoint captura la instancia de Firebase en el ámbito del módulo, durante la
// importación: `dbStore.current` debe existir ya aquí (nunca null) o todas las
// peticiones responden 500. `ref` delega en el espía vigente de cada test, porque los
// espías se recrean en el `beforeEach` y el objeto capturado no puede apuntar a ellos.
globalThis.dbStore = {
  current: {
    ref: (...args) => refMock(...args),
  },
};

vi.doMock('../../lib/firebase.js', () => ({
  getFirebaseDb: () => globalThis.dbStore.current,
  incrementBy: (amount) => ({ __increment__: amount }),
}));

const { default: resetCounts } = await import('../reset-counts.js');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESET_COUNTS_SECRET = 'test-reset-secret';
  setMock = vi.fn().mockResolvedValue();
  onceMock = vi.fn();
  transactionMock = vi.fn().mockResolvedValue({ committed: true });
  removeMock = vi.fn().mockResolvedValue();
  refMock = vi.fn(() => ({
    set: setMock,
    once: onceMock,
    transaction: transactionMock,
    remove: removeMock,
  }));
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
  it('zeros the session counters and returns the previous values', async () => {
    onceMock.mockResolvedValue({ val: () => ({ scanned: 10, completed: 7 }) });

    const req = { method: 'POST', headers: { 'x-reset-secret': 'test-reset-secret' } };
    const res = createRes();

    await resetCounts(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default');
    expect(setMock).toHaveBeenCalledWith({ scanned: 0, completed: 0 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: 'Contadores reseteados exitosamente.',
      sessionId: 'default',
      previousCounts: { scanned: 10, completed: 7 },
    });
  });

  it('resets the session given by ?s=', async () => {
    onceMock.mockResolvedValue({ val: () => ({ scanned: 1, completed: 0 }) });

    const req = {
      method: 'POST',
      headers: { 'x-reset-secret': 'test-reset-secret' },
      query: { s: 'salon-9' },
    };
    const res = createRes();

    await resetCounts(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-9');
    expect(res.body.sessionId).toBe('salon-9');
  });

  it('returns 401 when the secret header is missing', async () => {
    const req = { method: 'POST', headers: {} };
    const res = createRes();

    await resetCounts(req, res);

    expect(res.statusCode).toBe(401);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret is wrong and does not touch the counters', async () => {
    const req = { method: 'POST', headers: { 'x-reset-secret': 'wrong-secret' } };
    const res = createRes();

    await resetCounts(req, res);

    expect(res.statusCode).toBe(401);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('returns 503 when RESET_COUNTS_SECRET is not configured (fail closed)', async () => {
    delete process.env.RESET_COUNTS_SECRET;

    const req = { method: 'POST', headers: { 'x-reset-secret': 'anything' } };
    const res = createRes();

    await resetCounts(req, res);

    expect(res.statusCode).toBe(503);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('allows the CORS preflight and exposes the X-Reset-Secret header', async () => {
    const req = { method: 'OPTIONS', headers: {} };
    const res = createRes();

    await resetCounts(req, res);

    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Headers']).toContain('X-Reset-Secret');
  });

  it('returns 405 for non-POST/OPTIONS methods', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createRes();

    await resetCounts(req, res);

    expect(res.statusCode).toBe(405);
  });
});
