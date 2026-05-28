import { env } from '@/config/env';
import { incrementScanCount } from '@/modules/qr/qr.repository';
import type { QrScanResult } from '@/modules/qr/qr.types';

export async function processQrScan(): Promise<QrScanResult> {
  const scanned = await incrementScanCount();

  return {
    scanned,
    redirectUrl: env.ZOHO_SURVEY_URL,
  };
}
