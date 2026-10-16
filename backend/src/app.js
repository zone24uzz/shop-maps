import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiRoutes, healthRoutes } from './routes/index.js';

/**
 * Builds the Express application. It has no side effects (no listening, no
 * database connection), so tests can create isolated instances.
 *
 * `isShuttingDown` lets the process tell the app that it is draining: every
 * response then asks the client to close its connection (see gracefulShutdown).
 */
export function createApp(config, { isShuttingDown = () => false } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // First, so every request is logged, including ones rejected further down.
  if (!config.isTest) app.use(requestLogger);

  app.use((_req, res, next) => {
    if (isShuttingDown()) res.set('Connection', 'close');
    next();
  });

  app.use(helmet());
  app.use(
    cors({
      // Only the configured frontend origins receive CORS headers.
      origin: [...config.corsOrigins],
      methods: ['GET', 'HEAD', 'OPTIONS'],
      maxAge: 600,
    }),
  );

  app.use('/api/health', healthRoutes);

  // The limiter runs before the body parser, so malformed bodies count
  // against the client's budget like any other request.
  app.use('/api', createRateLimiter(config.rateLimit), express.json({ limit: '10kb' }), apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
