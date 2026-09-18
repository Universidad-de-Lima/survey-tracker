import { beforeEach, describe, expect, it, vi } from 'vitest';

let setMock;
let refMock;
let store;

globalThis.dbStore = {
  current: {
    ref: (...args) => refMock(...args),
  },
};

vi.doMock('../../lib/firebase.js', () => ({
  getFirebaseDb: () => globalThis.dbStore.current,
  incrementBy: (amount) => ({ __increment__: amount }),
}));

const { default: done } = await import('../done.js');

beforeEach(() => {
  vi.clearAllMocks();
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
    end(body) {
      this.body = body;
      return this;
    },
  };
}

const AGRADECIMIENTO = 'encuesta quedó registrada';

describe('GET /api/done', () => {
  it('counts the completion in the campaign session when Zoho sends no parameter', async () => {
    const res = createRes();

    await done({ method: 'GET' }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default/completed');
    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.headers['Set-Cookie']).toContain('terminado_default_g0=1');
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(res.body).toContain(AGRADECIMIENTO);
  });

  it('respects the session Zoho sends back in ?s=', async () => {
    const res = createRes();

    await done({ method: 'GET', query: { s: 'salon-302' } }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-302/completed');
    expect(res.headers['Set-Cookie']).toContain('terminado_salon-302_g0=1');
  });

  it('reads the session from the url when req.query is absent', async () => {
    const res = createRes();

    await done({ method: 'GET', url: '/api/done?s=salon-401' }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-401/completed');
  });

  it('does not count twice when the student reloads the thanks page', async () => {
    const res = createRes();

    await done({ method: 'GET', headers: { cookie: 'otra=1; terminado_default_g0=1' } }, res);

    expect(setMock).not.toHaveBeenCalled();
    expect(res.headers['Set-Cookie']).toBeUndefined();
    expect(res.body).toContain(AGRADECIMIENTO);
  });

  it('counts the same phone again after a reset, because its cookie is stale', async () => {
    store['sessions/default'] = { scanned: 0, completed: 0, generacion: 2 };

    const res = createRes();
    await done({ method: 'GET', headers: { cookie: 'terminado_default_g0=1' } }, res);

    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.headers['Set-Cookie']).toContain('terminado_default_g2=1');
  });

  it('still shows the thanks page when counting fails', async () => {
    setMock.mockRejectedValue(new Error('firebase caído'));

    const res = createRes();
    await done({ method: 'GET' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain(AGRADECIMIENTO);
  });

  it('rejects methods other than GET', async () => {
    const res = createRes();

    await done({ method: 'POST' }, res);

    expect(res.statusCode).toBe(405);
  });
});
