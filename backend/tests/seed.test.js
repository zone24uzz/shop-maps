import './helpers/setup.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { DEMO_SOURCE, DEMO_STORES } from '../src/data/demoStores.js';
import { Store } from '../src/models/Store.js';
import { seedStoresIfEmpty } from '../src/services/seedService.js';
import { startTestDatabase } from './helpers/testDb.js';

describe('demo store seeding', () => {
  let db;

  before(async () => {
    db = await startTestDatabase();
  });

  beforeEach(async () => {
    await db.clear();
  });

  after(async () => {
    await db.stop();
  });

  it('inserts the five demo stores into an empty collection', async () => {
    const result = await seedStoresIfEmpty();

    assert.deepEqual(result, { seeded: true, inserted: 5 });
    assert.equal(await Store.countDocuments(), 5);

    const stores = await Store.find().lean();
    for (const demo of DEMO_STORES) {
      const stored = stores.find((store) => store.name === demo.name);
      assert.ok(stored, `missing ${demo.name}`);
      assert.equal(stored.source, DEMO_SOURCE);
      assert.equal(stored.lat, demo.lat);
      assert.equal(stored.lng, demo.lng);
      assert.ok(stored.createdAt instanceof Date);
      assert.ok(stored.updatedAt instanceof Date);
    }
  });

  it('keeps every demo store inside the Tashkent area', () => {
    assert.equal(DEMO_STORES.length, 5);
    for (const store of DEMO_STORES) {
      assert.ok(store.lat > 41.15 && store.lat < 41.45, `${store.name} latitude`);
      assert.ok(store.lng > 69.1 && store.lng < 69.45, `${store.name} longitude`);
      assert.match(store.name, /demo/i);
    }
  });

  it('does not duplicate records when it runs again', async () => {
    await seedStoresIfEmpty();
    const second = await seedStoresIfEmpty();
    const third = await seedStoresIfEmpty();

    assert.deepEqual(second, { seeded: false, inserted: 0 });
    assert.deepEqual(third, { seeded: false, inserted: 0 });
    assert.equal(await Store.countDocuments(), 5);
  });

  it('stays at five stores when two instances seed at the same time', async () => {
    const results = await Promise.all([seedStoresIfEmpty(), seedStoresIfEmpty()]);

    assert.equal(await Store.countDocuments(), 5);
    assert.equal(results[0].inserted + results[1].inserted, 5);

    // The slower seeder must not have rewritten what the faster one inserted.
    for (const store of await Store.find().lean()) {
      assert.equal(store.updatedAt.getTime(), store.createdAt.getTime(), store.name);
    }
  });

  it('never modifies stores that already exist', async () => {
    await seedStoresIfEmpty();
    const before = await Store.find().sort({ _id: 1 }).lean();

    await new Promise((resolve) => setTimeout(resolve, 20));
    await seedStoresIfEmpty();
    await Promise.all([seedStoresIfEmpty(), seedStoresIfEmpty()]);

    assert.deepEqual(await Store.find().sort({ _id: 1 }).lean(), before);
  });

  it('leaves existing real data untouched and adds no demo stores', async () => {
    const real = await Store.create({
      name: 'Real store',
      source: 'admin',
      lat: 41.3,
      lng: 69.25,
    });

    const result = await seedStoresIfEmpty();

    assert.deepEqual(result, { seeded: false, inserted: 0 });
    const stores = await Store.find().lean();
    assert.equal(stores.length, 1);
    assert.equal(stores[0]._id.toString(), real._id.toString());
    assert.equal(stores[0].name, 'Real store');
  });

  it('enforces uniqueness for demo stores only', async () => {
    await seedStoresIfEmpty();

    await assert.rejects(
      Store.create({ ...DEMO_STORES[0] }),
      (error) => error.code === 11000,
      'a duplicate demo store must be rejected by the unique index',
    );

    // Real stores may legitimately share a name and a source.
    const shared = { name: 'Chain store', source: 'admin', lat: 41.3, lng: 69.25 };
    await Store.create(shared);
    await Store.create(shared);
    assert.equal(await Store.countDocuments({ source: 'admin' }), 2);
  });
});
