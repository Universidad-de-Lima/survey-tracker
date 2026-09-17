import { beforeEach, describe, expect, it, vi } from 'vitest';

let refMock;
let onceMock;

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
}));

const { default: getCounts } = await import('../get-counts.js');

beforeEach(() => {
  vi.clearAllMocks();
  refMock = vi.fn();
  onceMock = vi.fn();
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

describe('GET /api/get-counts', () => {
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
