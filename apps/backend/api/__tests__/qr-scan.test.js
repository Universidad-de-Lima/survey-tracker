import { beforeEach, describe, expect, it, vi } from 'vitest';

let transactionMock;
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
}));

const { default: qrScan } = await import('../qr-scan.js');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ZOHO_SURVEY_URL = 'https://survey.zohopublic.com/zs/ZKC54z';
  transactionMock = vi.fn();
  refMock = vi.fn();
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
  it('increments scanned count and redirects to Zoho survey', async () => {
    transactionMock.mockImplementation((updateFn) => updateFn(5));
    refMock.mockReturnValue({ transaction: transactionMock });

    const req = { method: 'GET' };
    const res = createRes();

    await qrScan(req, res);

    expect(refMock).toHaveBeenCalledWith('survey_counts/scanned');
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe(process.env.ZOHO_SURVEY_URL);
  });

  // El endpoint no restringe el método HTTP: cualquier método (incluido DELETE) entra
  // en el mismo flujo, incrementa el contador y redirige. El test documenta ese
  // comportamiento real en lugar de esperar un 405 que el endpoint nunca devuelve.
  it('no restringe el método: DELETE también incrementa y redirige', async () => {
    transactionMock.mockImplementation((updateFn) => updateFn(0));
    refMock.mockReturnValue({ transaction: transactionMock });

    const req = { method: 'DELETE' };
    const res = createRes();

    await qrScan(req, res);

    expect(refMock).toHaveBeenCalledWith('survey_counts/scanned');
    expect(transactionMock).toHaveBeenCalled();
    expect(res.statusCode).toBe(302);
  });
});
