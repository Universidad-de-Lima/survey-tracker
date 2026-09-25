import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .url('VITE_API_BASE_URL must be a valid URL')
    .default('https://encuesta-pregrado.vercel.app/api'),
});

function parseEnv() {
  const result = envSchema.safeParse({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  });

  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    // Un valor inválido no puede dejar el panel sin API: se usa el valor por defecto,
    // que está escrito una sola vez (en el esquema de arriba).
    return envSchema.parse({});
  }

  return result.data;
}

export const envConfig = parseEnv();
