import './helpers/setup.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config/env.js';
import { Store } from '../src/models/Store.js';

const VALID_ENV = {
  NODE_ENV: 'development',
  PORT: '5000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/logistics_map',
  FRONTEND_URL: 'http://localhost:3000',
};

describe('environment configuration', () => {
  it('parses a valid environment and applies defaults', () => {
    const config = loadConfig(VALID_ENV);

    assert.equal(config.port, 5000);
    assert.equal(config.isProduction, false);
    assert.deepEqual([...config.corsOrigins], ['http://localhost:3000']);
    assert.deepEqual({ ...config.rateLimit }, { max: 300, windowMs: 900_000 });
    assert.equal(config.trustProxy, 0);
    assert.equal(config.dbConnectRetries, 5);
  });

  it('accepts several comma-separated origins and normalises them as browsers send them', () => {
    const config = loadConfig({
      ...VALID_ENV,
      FRONTEND_URL: 'http://localhost:3000, HTTPS://Map.Example.com:443/, https://map.example.com,',
    });
    assert.deepEqual([...config.corsOrigins], ['http://localhost:3000', 'https://map.example.com']);
  });

  it('rejects frontend URLs that are not bare origins', () => {
    const notOrigins = [
      'https://map.example.com/app',
      'https://map.example.com?x=1',
      'https://map.example.com/#top',
      'https://user:pw@map.example.com',
      'https://*.example.com',
      'ftp://map.example.com',
      'map.example.com',
      '*',
      '',
      ' , ',
    ];

    for (const value of notOrigins) {
      assert.throws(
        () => loadConfig({ ...VALID_ENV, FRONTEND_URL: value }),
        /FRONTEND_URL/,
        `"${value}" must be rejected`,
      );
    }
  });

  it('names every missing required variable', () => {
    assert.throws(
      () => loadConfig({}),
      (error) => {
        for (const name of ['NODE_ENV', 'PORT', 'MONGODB_URI', 'FRONTEND_URL']) {
          assert.match(error.message, new RegExp(name));
        }
        return true;
      },
    );
  });

  it('rejects malformed values without echoing them', () => {
    const invalid = {
      ...VALID_ENV,
      PORT: '99999',
      MONGODB_URI: 'postgres://user:hunter2@db/app',
      FRONTEND_URL: '*',
    };

    assert.throws(
      () => loadConfig(invalid),
      (error) => {
        assert.match(error.message, /PORT/);
        assert.match(error.message, /MONGODB_URI/);
        assert.match(error.message, /FRONTEND_URL/);
        assert.doesNotMatch(error.message, /hunter2/);
        return true;
      },
    );
  });
});

describe('Store model validation', () => {
  const valid = { name: 'Store', source: 'admin', lat: 41.3, lng: 69.24 };
  const errorsFor = async (fields) => {
    try {
      await new Store(fields).validate();
      return [];
    } catch (error) {
      return Object.keys(error.errors ?? {});
    }
  };

  it('accepts a valid store, including the coordinate boundaries', async () => {
    assert.deepEqual(await errorsFor(valid), []);
    assert.deepEqual(await errorsFor({ ...valid, lat: -90, lng: 180 }), []);
    assert.deepEqual(await errorsFor({ ...valid, lat: 90, lng: -180 }), []);
  });

  it('requires a non-empty name and source', async () => {
    assert.deepEqual(await errorsFor({ ...valid, name: undefined }), ['name']);
    assert.deepEqual(await errorsFor({ ...valid, name: '   ' }), ['name']);
    assert.deepEqual(await errorsFor({ ...valid, source: '' }), ['source']);
  });

  it('rejects coordinates outside the valid ranges', async () => {
    assert.deepEqual(await errorsFor({ ...valid, lat: 90.01 }), ['lat']);
    assert.deepEqual(await errorsFor({ ...valid, lat: -91 }), ['lat']);
    assert.deepEqual(await errorsFor({ ...valid, lng: 180.5 }), ['lng']);
    assert.deepEqual(await errorsFor({ ...valid, lng: -181 }), ['lng']);
    assert.deepEqual(await errorsFor({ ...valid, lat: 'north' }), ['lat']);
    assert.deepEqual((await errorsFor({ name: 'Store', source: 'admin' })).sort(), ['lat', 'lng']);
  });

  it('refuses fields that are not part of the schema', () => {
    assert.throws(() => new Store({ ...valid, isAdmin: true }), /isAdmin/);
  });
});
