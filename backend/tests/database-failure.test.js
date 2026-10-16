import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDatabase, isDatabaseReady } from '../src/config/database.js';
import { Store } from '../src/models/Store.js';
import { seedStoresIfEmpty } from '../src/services/seedService.js';
import { createTestConfig, startTestDatabase } from './helpers/testDb.js';

const DATABASE_UNAVAILABLE = {
  success: false,
  error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not available' },
};

describe('database failure handling', () => {
  let db;
  let app;

  before(async () => {
    db = await startTestDatabase();
    await seedStoresIfEmpty();
    app = createApp(createTestConfig());
  });

  after(async () => {
    await db.stop();
  });

  it('hides the details of an unexpected query error', async () => {
    const find = mock.method(Store, 'find', () => {
      throw new Error('E11000 secret internal detail at mongodb://user:pass@host');
    });

    try {
      const response = await request(app).get('/api/stores').expect(500);

      assert.deepEqual(response.body, {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      });
      assert.doesNotMatch(JSON.stringify(response.body), /secret|mongodb:|stack|at /);
    } finally {
      find.mock.restore();
    }
  });

  it('maps a driver connectivity error raised mid-request to 503', async () => {
    const find = mock.method(Store, 'find', () => {
      const error = new Error('connection timed out to 10.0.0.5:27017');
      error.name = 'MongoServerSelectionError';
      throw error;
    });

    try {
      const response = await request(app).get('/api/stores').expect(503);
      assert.deepEqual(response.body, DATABASE_UNAVAILABLE);
    } finally {
      find.mock.restore();
    }
  });

  it('answers 503 quickly while the database is disconnected, then recovers', async () => {
    await mongoose.disconnect();
    assert.equal(isDatabaseReady(), false);

    const startedAt = Date.now();
    const [list, single, health] = await Promise.all([
      request(app).get('/api/stores'),
      request(app).get(`/api/stores/${new mongoose.Types.ObjectId()}`),
      request(app).get('/api/health'),
    ]);

    for (const response of [list, single, health]) {
      assert.equal(response.status, 503);
      assert.deepEqual(response.body, DATABASE_UNAVAILABLE);
    }
    assert.ok(Date.now() - startedAt < 2000, 'requests must fail fast, not wait for a timeout');

    await db.connect();
    const recovered = await request(app).get('/api/stores').expect(200);
    assert.equal(recovered.body.count, 5);
  });

  it('rejects the initial connection when MongoDB is unreachable', async () => {
    await mongoose.disconnect();

    // Port 9 (discard) is not a MongoDB server.
    const uri = 'mongodb://app_user:app_password@127.0.0.1:9/logistics_map';
    await assert.rejects(connectDatabase(uri, { retries: 2, retryDelayMs: 10 }), (error) => {
      assert.ok(error.message.includes('Could not connect to MongoDB after 2 attempt(s)'));
      assert.doesNotMatch(error.message, /app_password/);
      return true;
    });
    assert.equal(isDatabaseReady(), false);

    await db.connect();
  });

  it('does not retry or echo a connection string the driver cannot parse', async () => {
    await mongoose.disconnect();

    // Unescaped "/" and "@" in a password are a common mistake with generated secrets.
    for (const uri of [
      'mongodb://app_user:pa/ss-SECRET@127.0.0.1:9/logistics_map',
      'mongodb://app_user:p@ss-SECRET@127.0.0.1:9/logistics_map',
    ]) {
      const startedAt = Date.now();
      await assert.rejects(connectDatabase(uri, { retries: 5, retryDelayMs: 1000 }), (error) => {
        assert.ok(error.message.includes('after 1 attempt(s)'), error.message);
        assert.doesNotMatch(error.message, /SECRET/);
        return true;
      });
      assert.ok(Date.now() - startedAt < 900, 'a parse error must fail without waiting to retry');
    }

    await db.connect();
  });
});
