import { z } from 'zod';

export const surveyCountsResponseSchema = z.object({
  scanned: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});

export type SurveyCountsResponseDto = z.infer<typeof surveyCountsResponseSchema>;
