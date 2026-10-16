import { isDatabaseReady } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/**
 * Rejects malformed ids before they reach a query. Stricter than
 * `mongoose.isValidObjectId`, which also accepts any 12-character string.
 */
export function validateObjectIdParam(paramName) {
  return (req, _res, next) => {
    const value = req.params[paramName];
    if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
      throw AppError.badRequest('INVALID_STORE_ID', 'Store id must be a 24-character hex string');
    }
    next();
  };
}

/** Answers 503 immediately while MongoDB is unreachable instead of hanging. */
export function requireDatabase(_req, _res, next) {
  if (!isDatabaseReady()) {
    throw AppError.serviceUnavailable('DATABASE_UNAVAILABLE', 'Database is not available');
  }
  next();
}

/** Explicit 405 for known paths: the public API is read-only. */
export function methodNotAllowed(allowedMethods) {
  return (req, res, next) => {
    res.set('Allow', allowedMethods.join(', '));
    next(
      new AppError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} is not allowed on this route`),
    );
  };
}
