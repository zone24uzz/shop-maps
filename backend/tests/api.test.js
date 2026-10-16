import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { DEMO_SOURCE, DEMO_STORES } from '../src/data/demoStores.js';
import { Store } from '../src/models/Store.js';
import { seedStoresIfEmpty } from '../src/services/seedService.js';
import { createTestConfig, startTestDatabase } from './helpers/testDb.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const STORE_KEYS = ['_id', 'createdAt', 'lat', 'lng', 'name', 'source', 'updatedAt'];

describe('REST API', () => {
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

  describe('GET /api/health', () => {
    it('reports ok while the database is connected', async () => {
      const response = await request(app).get('/api/health').expect(200);
      assert.deepEqual(response.body, { success: true, status: 'ok' });
    });
  });

  describe('GET /api/stores', () => {
    it('returns the seeded stores with a matching count', async () => {
      const response = await request(app)
        .get('/api/stores')
        .expect(200)
        .expect('Content-Type', /application\/json/);

      assert.equal(response.body.success, true);
      assert.equal(response.body.count, DEMO_STORES.length);
      assert.equal(response.body.data.length, DEMO_STORES.length);
    });

    it('exposes exactly the public store fields with valid values', async () => {
      const response = await request(app).get('/api/stores').expect(200);

      for (const store of response.body.data) {
        assert.deepEqual(Object.keys(store).sort(), STORE_KEYS);
        assert.match(store._id, /^[a-f\d]{24}$/);
        assert.equal(typeof store.name, 'string');
        assert.ok(store.name.length > 0);
        assert.equal(store.source, DEMO_SOURCE);
        assert.ok(store.lat >= -90 && store.lat <= 90);
        assert.ok(store.lng >= -180 && store.lng <= 180);
        assert.match(store.createdAt, ISO_DATE);
        assert.match(store.updatedAt, ISO_DATE);
      }
    });

    it('labels every seeded store as demo data and sorts by name', async () => {
      const response = await request(app).get('/api/stores').expect(200);
      const names = response.body.data.map((store) => store.name);

      assert.ok(names.every((name) => name.toLowerCase().includes('demo')));
      assert.deepEqual(names, [...names].sort());
    });
  });

  describe('GET /api/stores/:id', () => {
    it('returns a single store', async () => {
      const list = await request(app).get('/api/stores').expect(200);
      const expected = list.body.data[0];

      const response = await request(app).get(`/api/stores/${expected._id}`).expect(200);
      assert.deepEqual(response.body, { success: true, data: expected });
    });

    it('rejects a malformed id with 400', async () => {
      for (const id of ['not-an-id', '123', 'zzzzzzzzzzzzzzzzzzzzzzzz', 'twelve-chars']) {
        const response = await request(app).get(`/api/stores/${id}`).expect(400);
        assert.equal(response.body.success, false);
        assert.equal(response.body.error.code, 'INVALID_STORE_ID');
      }
    });

    it('does not treat query operators in the id as a filter', async () => {
      const response = await request(app).get('/api/stores/%7B%22%24ne%22%3Anull%7D').expect(400);
      assert.equal(response.body.error.code, 'INVALID_STORE_ID');
    });

    it('returns 404 for a well-formed id that does not exist', async () => {
      const missingId = new mongoose.Types.ObjectId().toString();
      const response = await request(app).get(`/api/stores/${missingId}`).expect(404);
      assert.deepEqual(response.body, {
        success: false,
        error: { code: 'STORE_NOT_FOUND', message: 'Store not found' },
      });
    });
  });

  describe('routing and method handling', () => {
    it('answers unknown routes with a JSON 404', async () => {
      for (const path of ['/api/unknown', '/api/stores/abc/def', '/', '/admin']) {
        const response = await request(app)
          .get(path)
          .expect('Content-Type', /application\/json/);
        assert.equal(response.status, 404);
        assert.equal(response.body.success, false);
        assert.equal(response.body.error.code, 'ROUTE_NOT_FOUND');
      }
    });

    it('is read-only: write methods are rejected with 405', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const attempts = [
        request(app).post('/api/stores').send({ name: 'x', source: 'y', lat: 1, lng: 1 }),
        request(app).put(`/api/stores/${id}`).send({ name: 'x' }),
        request(app).patch(`/api/stores/${id}`).send({ name: 'x' }),
        request(app).delete(`/api/stores/${id}`),
      ];

      for (const response of await Promise.all(attempts)) {
        assert.equal(response.status, 405);
        assert.equal(response.headers.allow, 'GET, HEAD');
        assert.equal(response.body.error.code, 'METHOD_NOT_ALLOWED');
      }

      const list = await request(app).get('/api/stores').expect(200);
      assert.equal(list.body.count, DEMO_STORES.length);
    });

    it('rejects oversized request bodies with 413', async () => {
      const response = await request(app)
        .post('/api/stores')
        .send({ name: 'x'.repeat(20_000) })
        .expect(413);
      assert.equal(response.body.error.code, 'PAYLOAD_TOO_LARGE');
    });

    it('answers an undecodable URL with 400, not a server error', async () => {
      for (const path of ['/api/stores/%', '/api/stores/%E0%A4%A']) {
        const response = await request(app).get(path).expect(400);
        assert.deepEqual(response.body, {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Request could not be processed' },
        });
      }
    });

    it('answers an unsupported body charset or encoding with 415', async () => {
      const attempts = [
        request(app).post('/api/stores').set('Content-Type', 'application/json; charset=foo'),
        request(app)
          .post('/api/stores')
          .set('Content-Type', 'application/json')
          .set('Content-Encoding', 'foo'),
      ];

      for (const attempt of attempts) {
        const response = await attempt.send('{}').expect(415);
        assert.equal(response.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
      }
    });

    it('rejects malformed JSON with 400', async () => {
      const response = await request(app)
        .post('/api/stores')
        .set('Content-Type', 'application/json')
        .send('{"name":')
        .expect(400);
      assert.equal(response.body.error.code, 'INVALID_JSON');
    });
  });

  describe('security headers and CORS', () => {
    it('sets helmet headers and hides the framework', async () => {
      const response = await request(app).get('/api/health').expect(200);
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.ok(response.headers['content-security-policy']);
      assert.equal(response.headers['x-powered-by'], undefined);
    });

    it('allows the configured frontend origin', async () => {
      const response = await request(app)
        .get('/api/stores')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:3000');
    });

    it('sends no CORS headers to other origins', async () => {
      const response = await request(app)
        .get('/api/stores')
        .set('Origin', 'https://evil.example')
        .expect(200);
      assert.equal(response.headers['access-control-allow-origin'], undefined);
    });

    it('limits preflight to read methods', async () => {
      const response = await request(app)
        .options('/api/stores')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect(204);
      assert.equal(response.headers['access-control-allow-methods'], 'GET,HEAD,OPTIONS');
    });
  });

  describe('rate limiting', () => {
    const limitedApp = () =>
      createApp(createTestConfig({ rateLimit: { max: 2, windowMs: 60_000 } }));

    it('answers 429 with a JSON error once the limit is exceeded', async () => {
      const app = limitedApp();

      await request(app).get('/api/stores').expect(200);
      await request(app).get('/api/stores').expect(200);
      const response = await request(app).get('/api/stores').expect(429);

      assert.deepEqual(response.body, {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
      });
    });

    it('counts requests with a rejected body against the limit', async () => {
      const app = limitedApp();
      const badBody = () =>
        request(app)
          .post('/api/stores')
          .set('Content-Type', 'application/json; charset=foo')
          .send('{}');

      await badBody().expect(415);
      await badBody().expect(415);
      await badBody().expect(429);
    });

    it('never limits the health check, so monitors can poll it freely', async () => {
      const app = limitedApp();

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await request(app).get('/api/health').expect(200);
      }
      // Health checks did not use up the budget of the real API either.
      await request(app).get('/api/stores').expect(200);
    });
  });

  describe('query plan', () => {
    it('serves the sorted list from an index instead of sorting in memory', async () => {
      const plan = await Store.find({})
        .sort({ name: 1, _id: 1 })
        .limit(1000)
        .explain('queryPlanner');
      const stages = JSON.stringify(plan.queryPlanner.winningPlan);

      assert.match(stages, /IXSCAN/);
      assert.doesNotMatch(stages, /"stage":"SORT"/);
      assert.doesNotMatch(stages, /COLLSCAN/);
    });
  });
});
