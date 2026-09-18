import { beforeEach, describe, expect, it, vi } from 'vitest';

let setMock;
let refMock;
let store;

// El endpoint captura la instancia de Firebase en el ámbito del módulo, durante la
// importación: `dbStore.current` debe existir ya aquí (nunca null) o todas las
// peticiones fallan. `ref` delega en el espía vigente de cada test.
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
  store = {};
  setMock = vi.fn().mockResolvedValue();
  // `once` devuelve el nodo de la sesión, de donde sale la generación de la cookie.
  refMock = vi.fn((path) => ({
    set: setMock,
    once: async () => ({ val: () => (path in store ? store[path] : null) }),
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
  it('counts the scan in the campaign session and redirects to Zoho', async () => {
    const res = createRes();

    await qrScan({ method: 'GET' }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default/scanned');
    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe(process.env.ZOHO_SURVEY_URL);
    expect(res.headers['Set-Cookie']).toContain('escaneo_default_g0=1');
  });

  it('counts into the session given by ?s=', async () => {
    const res = createRes();

    await qrScan({ method: 'GET', query: { s: 'salon-302' } }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-302/scanned');
    expect(res.headers['Set-Cookie']).toContain('escaneo_salon-302_g0=1');
    expect(res.statusCode).toBe(302);
  });

  it('does not count the same phone twice, but keeps redirecting', async () => {
    const res = createRes();

    await qrScan({ method: 'GET', headers: { cookie: 'escaneo_default_g0=1' } }, res);

    expect(setMock).not.toHaveBeenCalled();
    expect(res.headers['Set-Cookie']).toBeUndefined();
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe(process.env.ZOHO_SURVEY_URL);
  });

  it('counts the same phone again after a reset, because its cookie is stale', async () => {
    // El reset sube la generación: las cookies repartidas antes quedan invalidadas.
    store['sessions/default'] = { scanned: 0, completed: 0, generacion: 3 };

    const res = createRes();
    await qrScan({ method: 'GET', headers: { cookie: 'escaneo_default_g0=1' } }, res);

    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.headers['Set-Cookie']).toContain('escaneo_default_g3=1');
  });

  it('redirects to the survey even when counting fails', async () => {
    setMock.mockRejectedValue(new Error('firebase caído'));

    const res = createRes();
    await qrScan({ method: 'GET' }, res);

    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe(process.env.ZOHO_SURVEY_URL);
  });

  it('accepts POST and rejects other methods', async () => {
    const postRes = createRes();
    await qrScan({ method: 'POST' }, postRes);
    expect(postRes.statusCode).toBe(302);

    const deleteRes = createRes();
    await qrScan({ method: 'DELETE' }, deleteRes);
    expect(deleteRes.statusCode).toBe(405);
  });

  it('returns 204 for OPTIONS', async () => {
    const res = createRes();

    await qrScan({ method: 'OPTIONS' }, res);

    expect(res.statusCode).toBe(204);
  });
});
