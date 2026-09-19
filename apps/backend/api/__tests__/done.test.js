import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRes } from '../../test/helpers.js';

let setMock;
let refMock;

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
  setMock = vi.fn().mockResolvedValue();
  refMock = vi.fn(() => ({ set: setMock }));
});

const AGRADECIMIENTO = 'encuesta quedó registrada';

describe('GET /api/done', () => {
  it('counts the completion in the campaign session when Zoho sends no parameter', async () => {
    const res = createRes();

    await done({ method: 'GET' }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default/completed');
    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(res.body).toContain(AGRADECIMIENTO);
  });

  it('respects the session Zoho sends back in ?s=', async () => {
    const res = createRes();

    await done({ method: 'GET', query: { s: 'salon-302' } }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-302/completed');
  });

  it('reads the session from the url when req.query is absent', async () => {
    const res = createRes();

    await done({ method: 'GET', url: '/api/done?s=salon-401' }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-401/completed');
  });

  it('counts every completion, even if the page is reloaded', async () => {
    const primera = createRes();
    await done({ method: 'GET' }, primera);

    const segunda = createRes();
    await done({ method: 'GET', headers: { cookie: 'cualquier-cosa=1' } }, segunda);

    expect(setMock).toHaveBeenCalledTimes(2);
    expect(segunda.body).toContain(AGRADECIMIENTO);
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
