import { describe, it, expect, vi } from 'vitest';

// Mock Firebase
vi.mock('@/config/firebase', () => ({
  getFirebaseDb: vi.fn(),
}));

describe('QR Service', () => {
  it('should be importable', async () => {
    const { processQrScan } = await import('@/modules/qr/qr.service');
    expect(processQrScan).toBeDefined();
  });
});
