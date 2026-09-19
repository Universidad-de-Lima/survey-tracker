import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRes } from '../../test/helpers.js';

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

const { default: getCounts } = await import('../get-counts.js');

beforeEach(() => {
  vi.clearAllMocks();
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

describe('GET /api/get-counts', () => {
  it('returns the counters of the default session', async () => {
    onceMock.mockResolvedValue({ val: () => ({ scanned: 10, completed: 7 }) });

    const req = { method: 'GET' };
    const res = createRes();

    await getCounts(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ scanned: 10, completed: 7, pending: 3, sessionId: 'default' });
  });

  it('reads the session from ?s=', async () => {
    onceMock.mockResolvedValue({ val: () => ({ scanned: 4, completed: 4 }) });

    const req = { method: 'GET', query: { s: 'salon-a' } };
    const res = createRes();

    await getCounts(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-a');
    expect(res.body.sessionId).toBe('salon-a');
  });

  it('never returns NaN when scanned exists without completed', async () => {
    onceMock.mockResolvedValue({ val: () => ({ scanned: 3 }) });

    const req = { method: 'GET' };
    const res = createRes();

    await getCounts(req, res);

    expect(res.body).toEqual({ scanned: 3, completed: 0, pending: 3, sessionId: 'default' });
  });

  it('returns zeros for a session that has not started', async () => {
    onceMock.mockResolvedValue({ val: () => null });

    const req = { method: 'GET', query: { s: 'salon-nuevo' } };
    const res = createRes();

    await getCounts(req, res);

    expect(res.body).toEqual({ scanned: 0, completed: 0, pending: 0, sessionId: 'salon-nuevo' });
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
