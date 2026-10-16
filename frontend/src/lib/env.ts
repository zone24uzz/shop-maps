const DEFAULT_API_URL = 'http://localhost:5000';

/**
 * Base URL of the backend API, without a trailing slash.
 * `NEXT_PUBLIC_` values are inlined into the browser bundle at build time,
 * so this must never hold anything secret.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL).replace(
  /\/+$/,
  '',
);
