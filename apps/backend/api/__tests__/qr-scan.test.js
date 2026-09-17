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

const { default: qrScan } = await import('../qr-scan.js');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ZOHO_SURVEY_URL = 'https://survey.zohopublic.com/zs/ZKC54z';
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
    redirectUrl: undefined,
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
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = { ...this.headers, ...headers };
      return this;
    },
    end() {
      return this;
    },
  };
}

describe('GET /api/qr-scan', () => {
  it('increments the default session counter atomically and redirects to Zoho', async () => {
    const req = { method: 'GET' };
    const res = createRes();

    await qrScan(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default/scanned');
    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe(process.env.ZOHO_SURVEY_URL);
  });

  it('counts into the session given by ?s=', async () => {
    const req = { method: 'GET', query: { s: 'salon-302' } };
    const res = createRes();

    await qrScan(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-302/scanned');
    expect(res.statusCode).toBe(302);
  });

  it('counts a device only once per session, but keeps redirecting', async () => {
    transactionMock.mockResolvedValue({ committed: false }); // el dispositivo ya contaba

    const req = { method: 'GET', query: { s: 'salon-302', d: 'dev-abc' } };
    const res = createRes();

    await qrScan(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-302/devices/dev-abc');
    expect(setMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(302);
  });

  it('counts the first scan of a device', async () => {
    transactionMock.mockResolvedValue({ committed: true });

    const req = { method: 'GET', query: { s: 'salon-302', d: 'dev-abc' } };
    const res = createRes();

    await qrScan(req, res);

    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.statusCode).toBe(302);
  });

  it('accepts POST from the landing page and rejects other methods', async () => {
    const postRes = createRes();
    await qrScan({ method: 'POST', body: { session: 'salon-1' } }, postRes);
    expect(postRes.statusCode).toBe(302);

    const deleteRes = createRes();
    await qrScan({ method: 'DELETE' }, deleteRes);
    expect(deleteRes.statusCode).toBe(405);
  });

  it('returns 204 for OPTIONS', async () => {
    const req = { method: 'OPTIONS' };
    const res = createRes();

    await qrScan(req, res);

    expect(res.statusCode).toBe(204);
  });
});
