import { randomUUID } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDatabase } from '../../src/config/database.js';
import { MONGODB_BINARY_VERSION } from '../../scripts/mongoBinary.js';

/**
 * Starts a throwaway in-memory MongoDB on a random port with a unique
 * database name. Tests never touch the development or production database.
 */
export async function startTestDatabase() {
  const mongod = await MongoMemoryServer.create({
    binary: { version: MONGODB_BINARY_VERSION },
  });
  const uri = mongod.getUri(`logistics_map_test_${randomUUID().slice(0, 8)}`);

  // Through the application's own connection code, so its options are exercised.
  const connect = () => connectDatabase(uri);
  await connect();

  return {
    uri,
    connect,
    async clear() {
      const collections = await mongoose.connection.db.collections();
      await Promise.all(collections.map((collection) => collection.deleteMany({})));
    },
    async stop() {
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}

/** Application config for tests; the port is unused because supertest binds its own. */
export function createTestConfig(overrides = {}) {
  return {
    nodeEnv: 'test',
    isProduction: false,
    isTest: true,
    port: 5000,
    mongodbUri: 'mongodb://127.0.0.1:27017/unused',
    corsOrigins: ['http://localhost:3000'],
    rateLimit: { max: 1000, windowMs: 60_000 },
    trustProxy: 0,
    dbConnectRetries: 1,
    ...overrides,
  };
}
