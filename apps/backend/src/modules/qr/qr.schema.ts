import { z } from 'zod';

export const qrScanResponseSchema = z.object({
  scanned: z.number().int().nonnegative(),
});

export type QrScanResponseDto = z.infer<typeof qrScanResponseSchema>;
