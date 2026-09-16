import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.dbStore = { current: null };

vi.mock('../../lib/firebase.js', () => ({
  getFirebaseDb: () => globalThis.dbStore.current,
}));

import qrScan from '../qr-scan.js';

let transactionMock;
let refMock;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ZOHO_SURVEY_URL = 'https://survey.zohopublic.com/zs/ZKC54z';
  transactionMock = vi.fn();
  refMock = vi.fn();
  globalThis.dbStore.current = { ref: (path) => ({ transaction: transactionMock }) };
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

  it('returns 405 for unsupported methods', async () => {
    const req = { method: 'DELETE' };
    const res = createRes();

    await qrScan(req, res);

    expect(res.statusCode).toBe(405);
  });
});