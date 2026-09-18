import { beforeEach, describe, expect, it, vi } from 'vitest';

let setMock;
let onceMock;
let refMock;

// El endpoint captura la instancia de Firebase en el ámbito del módulo, durante la
// importación: `dbStore.current` debe existir ya aquí (nunca null) o todas las
// peticiones responden 500. `ref` delega en el espía vigente de cada test.
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
  setMock = vi.fn().mockResolvedValue();
  onceMock = vi.fn().mockResolvedValue({ val: () => ({ scanned: 0, completed: 0 }) });
  refMock = vi.fn(() => ({ set: setMock, once: onceMock }));
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
  it('zeros the campaign counters and returns the previous values', async () => {
    onceMock.mockResolvedValue({ val: () => ({ scanned: 10, completed: 7 }) });

    const res = createRes();
    await resetCounts({ method: 'POST' }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default');
    expect(setMock).toHaveBeenCalledWith({ scanned: 0, completed: 0, generacion: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: 'Contadores reseteados exitosamente.',
      sessionId: 'default',
      generacion: 1,
      previousCounts: { scanned: 10, completed: 7 },
    });
  });

  it('resets the session given by ?s=', async () => {
    onceMock.mockResolvedValue({ val: () => ({ scanned: 1, completed: 0 }) });

    const res = createRes();
    await resetCounts({ method: 'POST', query: { s: 'salon-9' } }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-9');
    expect(res.body.sessionId).toBe('salon-9');
  });

  it('raises the generation so the cookies handed out before are invalidated', async () => {
    onceMock.mockResolvedValue({ val: () => ({ scanned: 30, completed: 30, generacion: 4 }) });

    const res = createRes();
    await resetCounts({ method: 'POST' }, res);

    expect(setMock).toHaveBeenCalledWith({ scanned: 0, completed: 0, generacion: 5 });
    expect(res.body.generacion).toBe(5);
  });

  it('leaves the counters at zero when they were already zero', async () => {
    const res = createRes();

    await resetCounts({ method: 'POST' }, res);

    expect(setMock).toHaveBeenCalledWith({ scanned: 0, completed: 0 });
    expect(res.body.previousCounts).toEqual({ scanned: 0, completed: 0 });
  });

  it('returns 500 when Firebase fails', async () => {
    setMock.mockRejectedValue(new Error('firebase caído'));

    const res = createRes();
    await resetCounts({ method: 'POST' }, res);

    expect(res.statusCode).toBe(500);
  });

  it('allows the CORS preflight', async () => {
    const res = createRes();

    await resetCounts({ method: 'OPTIONS' }, res);

    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('returns 405 for non-POST/OPTIONS methods', async () => {
    const res = createRes();

    await resetCounts({ method: 'GET' }, res);

    expect(res.statusCode).toBe(405);
  });
});
