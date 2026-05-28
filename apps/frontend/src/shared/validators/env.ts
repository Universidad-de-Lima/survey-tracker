import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .url('VITE_API_BASE_URL must be a valid URL')
    .default('https://qr-smoky-theta.vercel.app/api'),
  VITE_APP_TITLE: z.string().default('Panel de Monitoreo de Encuesta'),
  VITE_POLL_INTERVAL: z.coerce.number().int().positive().default(5000),
});

function parseEnv() {
  const result = envSchema.safeParse({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_APP_TITLE: import.meta.env.VITE_APP_TITLE,
    VITE_POLL_INTERVAL: import.meta.env.VITE_POLL_INTERVAL,
  });

  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    // Fallback defaults for development
    return {
      VITE_API_BASE_URL: 'https://qr-smoky-theta.vercel.app/api',
      VITE_APP_TITLE: 'Panel de Monitoreo de Encuesta',
      VITE_POLL_INTERVAL: 5000,
    };
  }

  return result.data;
}

export const envConfig = parseEnv();
