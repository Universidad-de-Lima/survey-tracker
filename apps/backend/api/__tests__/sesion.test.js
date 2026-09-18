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

const { default: sesion } = await import('../sesion.js');

/** Doble de RTDB con árbol anidado, para poder leer `sessions` entero. */
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

    node[last] = value;
  }

  function removeAt(path) {
    const keys = path.split('/');
    const last = keys.pop();
    let node = tree;

    for (const key of keys) {
      if (typeof node[key] !== 'object' || node[key] === null) {
        return;
      }
      node = node[key];
    }

    delete node[last];
  }

  return {
    tree,
    ref: (path) => ({
      once: async () => ({ val: () => getAt(path) }),
      set: async (value) => setAt(path, value),
      remove: async () => removeAt(path),
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
const CERRADA = 'salon_2026-09-19_10-00';
const SECRETO = 'secreto-de-prueba';

function storeConHistorial() {
  dbMock.tree.sesion_actual = ABIERTA;
  dbMock.tree.sessions = {
    [ABIERTA]: { scanned: 30, completed: 28, inicio: 'inicio-abierta' },
    [CERRADA]: { scanned: 12, completed: 12, inicio: 'inicio-cerrada', fin: 'fin-cerrada' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock = createTreeDb();
});

describe('GET /api/sesion', () => {
  it('returns the open session and the history, newest first', async () => {
    storeConHistorial();

    const res = createRes();
    await sesion({ method: 'GET' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.actual).toMatchObject({
      id: ABIERTA,
      abierta: true,
      scanned: 30,
      completed: 28,
      pending: 2,
    });
    expect(res.body.historial.map((entry) => entry.id)).toEqual([ABIERTA, CERRADA]);
    expect(res.body.historial[1].abierta).toBe(false);
  });

  it('returns a null current session when none is open', async () => {
    const res = createRes();
    await sesion({ method: 'GET' }, res);

    expect(res.body.actual).toBeNull();
    expect(res.body.historial).toEqual([]);
  });
});

describe('POST /api/sesion', () => {
  it('fails closed when the operator secret is not configured', async () => {
    delete process.env.RESET_COUNTS_SECRET;
    storeConHistorial();

    const res = createRes();
    await sesion({ method: 'POST', headers: {} }, res);

    expect(res.statusCode).toBe(503);
    expect(dbMock.tree.sesion_actual).toBe(ABIERTA);
  });

  it('rejects a wrong or missing secret', async () => {
    process.env.RESET_COUNTS_SECRET = SECRETO;
    storeConHistorial();

    const sinCabecera = createRes();
    await sesion({ method: 'POST', headers: {} }, sinCabecera);
    expect(sinCabecera.statusCode).toBe(401);

    const malSecreto = createRes();
    await sesion({ method: 'POST', headers: { 'x-reset-secret': 'otro' } }, malSecreto);
    expect(malSecreto.statusCode).toBe(401);

    expect(dbMock.tree.sesion_actual).toBe(ABIERTA);
    expect(dbMock.tree.sessions[ABIERTA].fin).toBeUndefined();
  });

  it('closes the open classroom and frees the slot for the next one', async () => {
    process.env.RESET_COUNTS_SECRET = SECRETO;
    storeConHistorial();

    const res = createRes();
    await sesion({ method: 'POST', headers: { 'x-reset-secret': SECRETO } }, res);

    expect(res.statusCode).toBe(200);
    expect(dbMock.tree.sessions[ABIERTA].fin).toBeTruthy();
    expect(dbMock.tree.sesion_actual).toBeUndefined();
    expect(res.body.sesion).toMatchObject({ id: ABIERTA, scanned: 30, completed: 28 });
    expect(res.body.sesion.abierta).toBe(false);
    // El histórico no se borra: el salón cerrado sigue ahí con sus contadores.
    expect(dbMock.tree.sessions[ABIERTA].scanned).toBe(30);
    expect(dbMock.tree.sessions[CERRADA].scanned).toBe(12);
  });

  it('returns 409 when there is no classroom to close', async () => {
    process.env.RESET_COUNTS_SECRET = SECRETO;

    const res = createRes();
    await sesion({ method: 'POST', headers: { 'x-reset-secret': SECRETO } }, res);

    expect(res.statusCode).toBe(409);
  });
});

describe('sesion methods', () => {
  it('returns 204 for OPTIONS and 405 for other methods', async () => {
    const optionsRes = createRes();
    await sesion({ method: 'OPTIONS' }, optionsRes);
    expect(optionsRes.statusCode).toBe(204);

    const deleteRes = createRes();
    await sesion({ method: 'DELETE' }, deleteRes);
    expect(deleteRes.statusCode).toBe(405);
  });
});
