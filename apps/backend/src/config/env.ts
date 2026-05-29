import { z } from 'zod';

const envSchema = z.object({
  // Firebase
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().min(1, 'FIREBASE_SERVICE_ACCOUNT_KEY is required').default('{}'),
  FIREBASE_DATABASE_URL: z.string().url('FIREBASE_DATABASE_URL must be a valid URL').default('https://test.firebaseio.com'),

  // Zoho
  ZOHO_SURVEY_URL: z.string().url('ZOHO_SURVEY_URL must be a valid URL').default('https://survey.zoho.com/test'),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

  // Reset API Key
  RESET_API_KEY: z.string().min(1, 'RESET_API_KEY is required').default('dev-reset-key'),
});

function parseEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    if (process.env.NODE_ENV === 'test') {
      // Return defaults when running tests without env vars
      return envSchema.parse({});
    }
    console.error('❌ Environment variable validation failed:');
    const formatted = result.error.format();
    for (const [key, issue] of Object.entries(formatted)) {
      if (key === '_errors') continue;
      console.error(`  - ${key}: ${(issue as { _errors: string[] })._errors.join(', ')}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();
