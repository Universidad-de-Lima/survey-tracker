import type { FastifyInstance } from 'fastify';
import { handleQrScan } from '@/modules/qr/qr.controller';

export async function qrRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/qr-scan', handleQrScan);
}
