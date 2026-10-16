import { logger } from '../utils/logger.js';

/**
 * Logs one line per request: method, path, status and duration.
 * Listens for `close` rather than `finish`, so requests the client abandoned
 * before the response completed are logged too, marked as aborted.
 */
export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  res.on('close', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const outcome = res.writableFinished ? res.statusCode : 'aborted';
    logger.info(`${req.method} ${req.originalUrl} ${outcome} ${durationMs.toFixed(1)}ms`);
  });
  next();
}
