import { beforeEach, describe, expect, it, vi } from 'vitest';

let dbMock;

globalThis.dbStore = {
  current: {
    ref: (...args) => dbMock.ref(...args),
  },
};

vi.doMock('../../lib/firebase.js', () => ({
  getFirebaseDb: () => globalThis.dbStore.current,
  incrementBy: (amount) => ({ __increment__: amount }),
}));

const { default: done } = await import('../done.js');

/** Doble de RTDB con árbol anidado: `set(incrementBy(n))` suma en servidor. */
function createTreeDb() {
  const tree = {};

  function getAt(path) {
    const valor = path
      .split('/')
      .reduce((node, key) => (node === undefined || node === null ? null : node[key]), tree);

    return valor === undefined ? null : valor;
  }

  function setAt(path, value) {
    const keys = path.split('/');
    const last = keys.pop();
    let node = tree;

    for (const key of keys) {
      if (typeof node[key] !== 'object' || node[key] === null) {
        node[key] = {};
      }
      node = node[key];
    }

    if (value && typeof value === 'object' && '__increment__' in value) {
      node[last] = (Number(node[last]) || 0) + value.__increment__;
      return;
    }

    node[last] = value;
  }

  return {
    tree,
    ref: (path) => ({
      once: async () => ({ val: () => getAt(path) }),
      set: async (value) => setAt(path, value),
    }),
  };
}

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

const ABIERTA = 'salon_2026-09-20_11-00';

beforeEach(() => {
  vi.clearAllMocks();
  dbMock = createTreeDb();
});

describe('GET /api/done', () => {
  it('counts the completion of the session Zoho sent back', async () => {
    const res = createRes();

    await done({ method: 'GET', query: { s: ABIERTA } }, res);

    expect(res.statusCode).toBe(200);
    expect(dbMock.tree.sessions[ABIERTA].completed).toBe(1);
    expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(res.headers['Set-Cookie']).toContain(`encuesta_${ABIERTA}=1`);
    expect(res.body).toContain('encuesta quedó registrada');
  });

  it('does not count twice when the student reloads the thanks page', async () => {
    dbMock.tree.sessions = { [ABIERTA]: { completed: 1 } };

    const res = createRes();
    await done(
      {
        method: 'GET',
        query: { s: ABIERTA },
        headers: { cookie: `otra=1; encuesta_${ABIERTA}=1` },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(dbMock.tree.sessions[ABIERTA].completed).toBe(1);
    expect(res.headers['Set-Cookie']).toBeUndefined();
    expect(res.body).toContain('encuesta quedó registrada');
  });

  it('does not count when the session parameter is missing', async () => {
    const res = createRes();

    await done({ method: 'GET', query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(Object.keys(dbMock.tree)).toHaveLength(0);
    expect(res.body).toContain('encuesta quedó registrada');
  });

  it('reads the session from the url when req.query is absent', async () => {
    const res = createRes();

    await done({ method: 'GET', url: `/api/done?s=${ABIERTA}` }, res);

    expect(dbMock.tree.sessions[ABIERTA].completed).toBe(1);
  });

  it('does not count with a blank session id', async () => {
    const res = createRes();

    await done({ method: 'GET', query: { s: '   ' } }, res);

    expect(Object.keys(dbMock.tree)).toHaveLength(0);
  });

  it('rejects methods other than GET', async () => {
    const res = createRes();

    await done({ method: 'POST' }, res);

    expect(res.statusCode).toBe(405);
  });
});
