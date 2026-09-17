import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { default: zohoWebhook } = await import('../zoho-webhook.js');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ZOHO_WEBHOOK_SECRET = 'test-secret';
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

function completedRequest(extra = {}) {
  return {
    method: 'POST',
    headers: { 'x-webhook-secret': 'test-secret' },
    body: {
      response_status: 'COMPLETED',
      webhook_event: 'response_completed',
      response_id: 'resp-123',
    },
    ...extra,
  };
}

describe('POST /api/zoho-webhook', () => {
  it('returns 503 when the webhook secret is not configured (fail closed)', async () => {
    delete process.env.ZOHO_WEBHOOK_SECRET;

    const req = completedRequest({ headers: {} });
    const res = createRes();

    await zohoWebhook(req, res);

    expect(res.statusCode).toBe(503);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret header is missing', async () => {
    const req = completedRequest({ headers: {} });
    const res = createRes();

    await zohoWebhook(req, res);

    expect(res.statusCode).toBe(401);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret is wrong', async () => {
    const req = completedRequest({ headers: { 'x-webhook-secret': 'wrong' } });
    const res = createRes();

    await zohoWebhook(req, res);

    expect(res.statusCode).toBe(401);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload', async () => {
    const req = completedRequest({ body: { response_status: 'INCOMPLETE' } });
    const res = createRes();

    await zohoWebhook(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('increments the session completed counter atomically', async () => {
    const req = completedRequest();
    const res = createRes();

    await zohoWebhook(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default/processed/resp-123');
    expect(transactionMock).toHaveBeenCalled();
    expect(refMock).toHaveBeenCalledWith('sessions/default/completed');
    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.body.completed).toBe(true);
  });

  it('counts into the session given by ?s=', async () => {
    const req = completedRequest({ query: { s: 'salon-401' } });
    const res = createRes();

    await zohoWebhook(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/salon-401/completed');
  });

  it('does not increment twice for the same response_id (atomic claim)', async () => {
    transactionMock.mockResolvedValue({ committed: false }); // otro reintento ya lo reservó

    const req = completedRequest();
    const res = createRes();

    await zohoWebhook(req, res);

    expect(setMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.completed).toBe(false);
  });

  it('sanitizes the response_id before using it as a Firebase key', async () => {
    const req = completedRequest({
      body: {
        response_status: 'COMPLETED',
        webhook_event: 'response_completed',
        response_id: 'resp.123#test',
      },
    });
    const res = createRes();

    await zohoWebhook(req, res);

    expect(refMock).toHaveBeenCalledWith('sessions/default/processed/resp_123_test');
    expect(res.statusCode).toBe(200);
  });

  it('releases the claim if the counter cannot be written, so the retry counts', async () => {
    setMock.mockRejectedValue(new Error('firebase caido'));

    const req = completedRequest();
    const res = createRes();

    await zohoWebhook(req, res);

    expect(removeMock).toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
  });

  it('counts without idempotency when Zoho sends no response_id, and warns', async () => {
    const req = completedRequest({
      body: { response_status: 'COMPLETED', webhook_event: 'response_completed' },
    });
    const res = createRes();

    await zohoWebhook(req, res);

    expect(setMock).toHaveBeenCalledWith({ __increment__: 1 });
    expect(res.statusCode).toBe(200);
  });
});
