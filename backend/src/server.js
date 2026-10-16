import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { loadConfig } from './config/env.js';
import { seedStoresIfEmpty } from './services/seedService.js';
import { createGracefulShutdown } from './utils/gracefulShutdown.js';
import { logger } from './utils/logger.js';

function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}

async function main() {
  const config = loadConfig();
  const lifecycle = createGracefulShutdown({ cleanup: disconnectDatabase });

  // The API only starts listening after the database is reachable and seeded.
  await connectDatabase(config.mongodbUri, { retries: config.dbConnectRetries });
  await seedStoresIfEmpty();

  const app = createApp(config, { isShuttingDown: lifecycle.isShuttingDown });
  const server = await listen(app, config.port);
  logger.info(`API listening on http://localhost:${config.port} (${config.nodeEnv})`);

  lifecycle.attach(server);
  lifecycle.listenForSignals();
}

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled promise rejection: ${reason?.stack ?? reason}`);
  process.exit(1);
});

main().catch(async (error) => {
  const hint =
    error?.code === 'EADDRINUSE' ? ' (the port is already in use; change PORT in .env)' : '';
  logger.error(`Startup failed: ${error.message}${hint}`);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
