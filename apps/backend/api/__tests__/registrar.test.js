import { beforeEach, describe, expect, it, vi } from 'vitest';

let dbMock;

// El endpoint captura la instancia de Firebase durante la importación, así que
// `dbStore.current` debe existir ya aquí (nunca null) y `ref` delega en el doble
// vigente de cada test.
globalThis.dbStore = {
  current: {
    ref: (...args) => dbMock.ref(...args),
  },
};

vi.doMock('../../lib/firebase.js', () => ({
  getFirebaseDb: () => globalThis.dbStore.current,
  incrementBy: (amount) => ({ __increment__: amount }),
}));

const { default: registrar } = await import('../registrar.js');

/**
 * Doble de RTDB que guarda un árbol anidado de verdad: leer una ruta padre
 * devuelve sus hijos, y `set(incrementBy(n))` suma en lugar de sobrescribir,
 * igual que hace el servidor de Firebase.
 */
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
      transaction: async (update) => {
        if (getAt(path) !== null) {
          return { committed: false };
        }

        setAt(path, update(undefined));

        return { committed: true };
      },
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
    end() {
      return this;
    },
  };
}

const ABIERTA = 'salon_2026-09-20_11-00';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ZOHO_SURVEY_URL = 'https://survey.zohopublic.com/zs/ZKC54z';
  dbMock = createTreeDb();
});

describe('GET /api/registrar', () => {
  it('opens the session on the first scan and returns the survey url with it', async () => {
    const res = createRes();

    await registrar({ method: 'GET', query: { d: 'celular-1' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.sessionCreated).toBe(true);
    expect(res.body.sessionId).toMatch(/^salon_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/);
    expect(res.body.url).toBe(`https://survey.zohopublic.com/zs/ZKC54z?s=${res.body.sessionId}`);
    expect(dbMock.tree.sesion_actual).toBe(res.body.sessionId);
    expect(dbMock.tree.sessions[res.body.sessionId].scanned).toBe(1);
    expect(dbMock.tree.sessions[res.body.sessionId].inicio).toBeTruthy();
    expect(res.body).toMatchObject({ scanned: 1, completed: 0, pending: 1 });
  });

  it('keeps counting into the session that is already open', async () => {
    dbMock.tree.sesion_actual = ABIERTA;

    const res = createRes();
    await registrar({ method: 'GET' }, res);

    expect(res.body.sessionCreated).toBe(false);
    expect(res.body.sessionId).toBe(ABIERTA);
    expect(dbMock.tree.sessions[ABIERTA].scanned).toBe(1);
  });

  it('does not inflate the counter when the same phone scans twice', async () => {
    dbMock.tree.sesion_actual = ABIERTA;
    dbMock.tree.sessions = {
      [ABIERTA]: { scanned: 1, devices: { 'celular-1': { firstSeenAt: 'antes' } } },
    };

    const res = createRes();
    await registrar({ method: 'GET', query: { d: 'celular-1' } }, res);

    expect(res.body.countRegistered).toBe(false);
    expect(dbMock.tree.sessions[ABIERTA].scanned).toBe(1);
  });

  it('still counts and returns the url when the phone sends no device id', async () => {
    const res = createRes();

    await registrar({ method: 'POST' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.scanned).toBe(1);
    expect(res.body.url).toContain('?s=');
  });

  it('returns 204 for OPTIONS and 405 for other methods', async () => {
    const optionsRes = createRes();
    await registrar({ method: 'OPTIONS' }, optionsRes);
    expect(optionsRes.statusCode).toBe(204);

    const deleteRes = createRes();
    await registrar({ method: 'DELETE' }, deleteRes);
    expect(deleteRes.statusCode).toBe(405);
  });
});
