import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const CONNECTION_OPTIONS = Object.freeze({
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
});

const RETRY_DELAY_MS = 2000;

// A malformed connection string or invalid option fails the same way on every
// attempt, so retrying only delays the error message.
const NON_RETRYABLE_ERRORS = new Set([
  'MongoParseError',
  'MongoAPIError',
  'MongoInvalidArgumentError',
]);

// Fail fast instead of queueing queries while the driver is disconnected;
// such requests are answered with 503 by the requireDatabase middleware.
mongoose.set('bufferCommands', false);
// Drop query filter keys that are not part of the schema.
mongoose.set('strictQuery', true);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let listenersAttached = false;

function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (error) =>
    logger.error(`MongoDB connection error: ${error.message}`),
  );
}

/**
 * Opens the initial MongoDB connection, retrying a few times so the API can be
 * started together with the database (docker compose, `npm run dev`).
 * Rejects when every attempt fails; the caller must not start the HTTP server.
 *
 * The connection string is never logged: it may contain credentials, and no
 * masking is reliable for a string the driver itself could not parse.
 */
export async function connectDatabase(uri, { retries = 1, retryDelayMs = RETRY_DELAY_MS } = {}) {
  attachConnectionListeners();

  let lastError;
  let attempts = 0;
  while (attempts < retries) {
    attempts += 1;
    try {
      await mongoose.connect(uri, CONNECTION_OPTIONS);
      const { host, port, name } = mongoose.connection;
      logger.info(`MongoDB connected: ${host}:${port}/${name}`);
      return mongoose.connection;
    } catch (error) {
      lastError = error;
      logger.warn(`MongoDB connection attempt ${attempts}/${retries} failed: ${error.message}`);
      if (NON_RETRYABLE_ERRORS.has(error.name)) break;
      if (attempts < retries) await wait(retryDelayMs);
    }
  }

  throw new Error(
    `Could not connect to MongoDB after ${attempts} attempt(s): ${lastError.message}`,
    { cause: lastError },
  );
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

/** True only when queries can be served right now. */
export function isDatabaseReady() {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
