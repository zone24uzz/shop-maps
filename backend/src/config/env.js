import dotenv from 'dotenv';
import { z } from 'zod';

// Tests supply their own configuration and must not inherit backend/.env.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ quiet: true });
}

const ORIGIN_HINT =
  'must be an origin such as https://map.example.com (scheme, host and optional port only)';

/**
 * A CORS origin is compared to the browser's `Origin` header character by
 * character, so anything that is not a bare origin (a path, a wildcard,
 * credentials) would pass startup and then silently never match.
 * Valid entries are normalised the way browsers send them.
 */
const originSchema = z.string().transform((value, context) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    context.addIssue({ code: 'custom', message: ORIGIN_HINT });
    return z.NEVER;
  }

  const isBareOrigin =
    /^https?:$/.test(url.protocol) &&
    !value.includes('*') &&
    url.username === '' &&
    url.password === '' &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '';

  if (!isBareOrigin) {
    context.addIssue({ code: 'custom', message: ORIGIN_HINT });
    return z.NEVER;
  }

  return url.origin;
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  FRONTEND_URL: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(originSchema).min(1, 'must list at least one origin')),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  DB_CONNECT_RETRIES: z.coerce.number().int().min(1).max(50).default(5),
});

/**
 * Validates the process environment and returns the typed application config.
 * Throws with a readable summary (variable names only, never values, so a
 * malformed connection string cannot leak credentials into the logs).
 */
export function loadConfig(source = process.env) {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${problems}\nSee backend/.env.example for the expected variables.`,
    );
  }

  const env = parsed.data;

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    mongodbUri: env.MONGODB_URI,
    corsOrigins: Object.freeze([...new Set(env.FRONTEND_URL)]),
    rateLimit: Object.freeze({ max: env.RATE_LIMIT_MAX, windowMs: env.RATE_LIMIT_WINDOW_MS }),
    trustProxy: env.TRUST_PROXY,
    dbConnectRetries: env.DB_CONNECT_RETRIES,
  });
}
