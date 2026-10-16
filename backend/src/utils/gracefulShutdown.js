import { logger } from './logger.js';

const IDLE_SWEEP_INTERVAL_MS = 100;

/**
 * Stops accepting connections and resolves once every open connection has
 * finished. Resolves `false` if the deadline passed and the remaining
 * connections had to be cut.
 */
function closeServer(server, timeoutMs) {
  return new Promise((resolve) => {
    let forced = false;

    // A keep-alive socket that was busy when shutdown began goes idle later;
    // sweep repeatedly so it is closed as soon as its request completes.
    const sweep = setInterval(() => server.closeIdleConnections(), IDLE_SWEEP_INTERVAL_MS);
    const deadline = setTimeout(() => {
      forced = true;
      server.closeAllConnections();
    }, timeoutMs);

    server.close(() => {
      clearInterval(sweep);
      clearTimeout(deadline);
      resolve(!forced);
    });
    server.closeIdleConnections();
  });
}

/**
 * Coordinates an orderly exit: drain HTTP connections, then run `cleanup`
 * (closing the database), then exit. `cleanup` runs even when draining had to
 * be forced, so the database connection is always released.
 *
 * `exit` is injectable for tests.
 */
export function createGracefulShutdown({ cleanup, timeoutMs = 10_000, exit = process.exit }) {
  let server = null;
  let shuttingDown = false;

  async function shutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${reason} received, shutting down`);

    let exitCode = 0;

    if (server) {
      const drained = await closeServer(server, timeoutMs);
      if (!drained) {
        logger.warn(`Connections still open after ${timeoutMs}ms were closed forcibly`);
        exitCode = 1;
      }
    }

    try {
      await cleanup();
    } catch (error) {
      logger.error(`Cleanup failed during shutdown: ${error.message}`);
      exitCode = 1;
    }

    logger.info('Shutdown complete');
    exit(exitCode);
  }

  return {
    /** True from the moment a shutdown starts. */
    isShuttingDown: () => shuttingDown,
    /** Registers the HTTP server to drain. */
    attach(httpServer) {
      server = httpServer;
    },
    shutdown,
    /** Shuts down on SIGINT (Ctrl+C) and SIGTERM (process managers, containers). */
    listenForSignals() {
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    },
  };
}
