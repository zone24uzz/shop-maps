import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

/**
 * Per-IP request limiter using the in-memory store, which is correct for a
 * single API instance. Use a shared store (e.g. Redis) when scaling out.
 */
export function createRateLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later'));
    },
  });
}
