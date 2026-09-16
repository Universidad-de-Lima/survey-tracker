import { beforeEach, describe, expect, it, vi } from 'vitest';

const transactionMock = vi.fn();
const setMock = vi.fn();
const onceMock = vi.fn();
const refMock = vi.fn();
const databaseMock = { ref: refMock };

vi.mock('../../lib/firebase.js', () => ({
  getFirebaseDb: vi.fn(() => databaseMock),
}));

import zohoWebhook from '../zoho-webhook.js';

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

describe('POST /api/zoho-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZOHO_WEBHOOK_SECRET = 'test-secret';
  });

  it('accepts request when webhook secret is not configured', async () => {
    delete process.env.ZOHO_WEBHOOK_SECRET;
    onceMock.mockResolvedValue({ exists: () => false });
    transactionMock.mockImplementation((updateFn) => updateFn(7));
    setMock.mockResolvedValue();
    refMock.mockReturnValue({ once: onceMock, transaction: transactionMock, set: setMock });

    const req = {
      method: 'POST',
      headers: {},
      body: {
        response_status: 'COMPLETED',
        webhook_event: 'response_completed',
        response_id: 'resp-123',
      },
    };
    const res = createRes();

    await zohoWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.completed).toBe(true);
  });

  it('rejects request with invalid secret', async () => {
    const req = { method: 'POST', headers: { 'x-webhook-secret': 'wrong' }, body: {} };
    const res = createRes();

    await zohoWebhook(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid payload', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: { response_status: 'INCOMPLETE' },
    };
    const res = createRes();

    await zohoWebhook(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('increments completed count for valid completed response', async () => {
    onceMock.mockResolvedValue({ exists: () => false });
    transactionMock.mockImplementation((updateFn) => updateFn(7));
    setMock.mockResolvedValue();
    refMock.mockReturnValue({ once: onceMock, transaction: transactionMock, set: setMock });

    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: {
        response_status: 'COMPLETED',
        webhook_event: 'response_completed',
        response_id: 'resp-123',
      },
    };
    const res = createRes();

    await zohoWebhook(req, res);

    expect(transactionMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.completed).toBe(true);
  });

  it('does not increment twice for the same response_id', async () => {
    onceMock.mockResolvedValue({ exists: () => true, val: () => ({ processedAt: '2024-01-01' }) });
    refMock.mockReturnValue({ once: onceMock, transaction: transactionMock, set: setMock });

    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: {
        response_status: 'COMPLETED',
        webhook_event: 'response_completed',
        response_id: 'resp-123',
      },
    };
    const res = createRes();

    await zohoWebhook(req, res);

    expect(transactionMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.completed).toBe(false);
  });

  it('sanitizes response_id for Firebase keys', async () => {
    onceMock.mockResolvedValue({ exists: () => false });
    transactionMock.mockImplementation((updateFn) => updateFn(1));
    setMock.mockResolvedValue();
    refMock.mockReturnValue({ once: onceMock, transaction: transactionMock, set: setMock });

    const req = {
      method: 'POST',
      headers: { 'x-webhook-secret': 'test-secret' },
      body: {
        response_status: 'COMPLETED',
        webhook_event: 'response_completed',
        response_id: 'resp.123#test',
      },
    };
    const res = createRes();

    await zohoWebhook(req, res);

    expect(refMock).toHaveBeenCalledWith('processed_responses/resp_123_test');
    expect(res.statusCode).toBe(200);
  });
});
