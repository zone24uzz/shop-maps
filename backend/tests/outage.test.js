import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { MONGODB_BINARY_VERSION } from '../scripts/mongoBinary.js';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { createTestConfig } from './helpers/testDb.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startMongo = (port) =>
  MongoMemoryServer.create({
    binary: { version: MONGODB_BINARY_VERSION },
    instance: port ? { port } : {},
  });

// Unlike database-failure.test.js, which disconnects the driver by hand, this
// kills the real MongoDB process and brings it back, so it exercises what
// production relies on: the driver noticing the outage and reconnecting.
describe('MongoDB server outage', () => {
  let mongod;
  let app;

  before(async () => {
    mongod = await startMongo();
    await connectDatabase(mongod.getUri('logistics_map_outage_test'));
    app = createApp(createTestConfig());
  });

  after(async () => {
    await disconnectDatabase();
    await mongod.stop();
  });

  it('answers 503 while the server is down and recovers by itself when it returns', async () => {
    await request(app).get('/api/stores').expect(200);
    const { port } = mongod.instanceInfo;

    await mongod.stop();

    // The driver needs a moment to notice the dead server. Until then a request
    // may still succeed; what it must never do is hang, crash or answer 500.
    let during;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      during = await request(app).get('/api/stores');
      assert.ok([200, 503].includes(during.status), `unexpected status ${during.status}`);
      if (during.status === 503) break;
      await wait(500);
    }
    assert.equal(during.status, 503);
    assert.equal(during.body.error.code, 'DATABASE_UNAVAILABLE');

    // A query can fail on its dead socket before the driver has updated the
    // connection state that the health check reads, so health may lag briefly.
    let health;
    for (let attempt = 0; attempt < 20 && health !== 503; attempt += 1) {
      if (attempt > 0) await wait(250);
      health = (await request(app).get('/api/health')).status;
    }
    assert.equal(health, 503, 'the health check must report the outage');

    mongod = await startMongo(port);

    // No reconnect call here: the driver has to find the server again.
    let status;
    for (let attempt = 0; attempt < 60 && status !== 200; attempt += 1) {
      await wait(500);
      status = (await request(app).get('/api/stores')).status;
    }
    assert.equal(status, 200, 'the API must recover without a restart');
    assert.equal((await request(app).get('/api/health')).status, 200);
  });
});
