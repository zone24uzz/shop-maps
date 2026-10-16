import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const DATABASE_ERROR_NAMES = new Set([
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
  'MongoPoolClearedError',
  'MongooseServerSelectionError',
]);

const CLIENT_ERROR_BY_STATUS = {
  413: ['PAYLOAD_TOO_LARGE', 'Request body is too large'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'Request body type or encoding is not supported'],
};

/** Translates known library errors into client-safe AppErrors. */
function normalizeError(error) {
  if (error instanceof AppError) return error;

  if (error?.type === 'entity.parse.failed') {
    return AppError.badRequest('INVALID_JSON', 'Request body is not valid JSON');
  }

  if (error?.name === 'CastError') {
    return AppError.badRequest('INVALID_PARAMETER', 'Request contains an invalid parameter');
  }

  if (DATABASE_ERROR_NAMES.has(error?.name)) {
    return AppError.serviceUnavailable('DATABASE_UNAVAILABLE', 'Database is not available');
  }

  // Express and body-parser mark request faults (undecodable URL, unsupported
  // charset or encoding, oversized body) with a 4xx status. They are the
  // client's errors, not ours: keep the status, replace the library message.
  const status = error?.status ?? error?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    const [code, message] = CLIENT_ERROR_BY_STATUS[status] ?? [
      'BAD_REQUEST',
      'Request could not be processed',
    ];
    return new AppError(status, code, message);
  }

  return null;
}

/** Catch-all for requests that matched no route. */
export function notFoundHandler(req, _res, next) {
  next(AppError.notFound('ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} does not exist`));
}

/**
 * Central error middleware: the single place where errors become responses.
 * Unexpected errors are logged with their stack on the server and answered
 * with a generic message, so internals never reach the client.
 */
// Express identifies error middleware by its four-argument signature.
export function errorHandler(error, req, res, _next) {
  const known = normalizeError(error);

  if (!known) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${error?.stack ?? error}`);
  } else if (known.statusCode >= 500) {
    logger.warn(`${known.code} on ${req.method} ${req.originalUrl}: ${error?.message}`);
  }

  const statusCode = known?.statusCode ?? 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: known?.code ?? 'INTERNAL_ERROR',
      message: known?.message ?? 'An unexpected error occurred',
    },
  });
}
