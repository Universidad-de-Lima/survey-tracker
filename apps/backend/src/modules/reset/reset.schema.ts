import { z } from 'zod';

export const resetCountsResponseSchema = z.object({
  message: z.string(),
  previousCounts: z.object({
    scanned: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
  }),
});

export type ResetCountsResponseDto = z.infer<typeof resetCountsResponseSchema>;
