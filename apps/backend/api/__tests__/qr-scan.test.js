import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRes } from '../../test/helpers.js';

let setMock;
let onceMock;
let refMock;
let marca; // lo que Firebase ya tiene guardado como primer escaneo (null = nada)

// El endpoint captura la instancia de Firebase durante la importación, así que
// `dbStore.current` debe existir ya aquí (nunca null) o todas las peticiones fallan.
globalThis.dbStore = {
  current: {
    ref: (...args) => refMock(...args),
  },
};

vi.doMock('../../lib/firebase.js', () => ({
  getFirebaseDb: () => globalThis.dbStore.current,
  incrementBy: (amount) => ({ __increment__: amount }),
  serverTimestamp: () => ({ __timestamp__: true }),
}));

const { default: qrScan } = await import('../qr-scan.js');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ZOHO_SURVEY_URL = 'https://survey.zohopublic.com/zs/ZKC54z';
  marca = null;
  setMock = vi.fn().mockImplementation((valor) => {
    if (valor && valor.__timestamp__) {
      marca = 1758800000000; // el primer escaneo quedó guardado
    }
    return Promise.resolve();
  });
  onceMock = vi.fn().mockResolvedValue({ exists: () => marca !== null, val: () => marca });
  refMock = vi.fn(() => ({ set: setMock, once: onceMock }));
});

const incrementos = () => setMock.mock.calls.filter(([v]) => v && v.__increment__).length;
const marcasGuardadas = () => setMock.mock.calls.filter(([v]) => v && v.__timestamp__).length;

describe('GET /api/qr-scan', () => {
  it('counts the scan in the campaign session and redirects to Zoho', async () => {
    const res = createRes();

    await qrScan({ method: 'GET' }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default/scanned');
    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe(process.env.ZOHO_SURVEY_URL);
  });

  it('counts into the session given by ?s=', async () => {
    const res = createRes();

    await qrScan({ method: 'GET', query: { s: 'salon-302' } }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-302/scanned');
    expect(res.statusCode).toBe(302);
  });

  it('counts every scan, even when it comes from the same phone', async () => {
    // Sin deduplicación: cada escaneo suma.
    const primera = createRes();
    await qrScan({ method: 'GET', headers: { cookie: 'cualquier-cosa=1' } }, primera);

    const segunda = createRes();
    await qrScan({ method: 'GET', headers: { cookie: 'cualquier-cosa=1' } }, segunda);

    expect(incrementos()).toBe(2);
    expect(primera.statusCode).toBe(302);
    expect(segunda.statusCode).toBe(302);
  });

  it('guarda la marca del primer escaneo del salón', async () => {
    const res = createRes();
    await qrScan({ method: 'GET' }, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default/firstScanAt');
    expect(onceMock).toHaveBeenCalled();
    expect(marcasGuardadas()).toBe(1);
    expect(marca).not.toBeNull();
  });

  it('no pisa la marca del primer escaneo si ya existe', async () => {
    // Un salón ya empezado: la marca vieja manda, el cronómetro no se reinicia.
    marca = 1758700000000;
    const res = createRes();

    await qrScan({ method: 'GET' }, res);

    expect(marcasGuardadas()).toBe(0);
    expect(marca).toBe(1758700000000);
    expect(incrementos()).toBe(1);
  });

  it('el escaneo se cuenta igual si la marca del cronómetro falla', async () => {
    onceMock.mockRejectedValue(new Error('firebase lento para la marca'));

    const res = createRes();
    await qrScan({ method: 'GET' }, res);

    expect(incrementos()).toBe(1);
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe(process.env.ZOHO_SURVEY_URL);
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
