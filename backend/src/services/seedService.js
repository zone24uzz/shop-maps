import { DEMO_STORES } from '../data/demoStores.js';
import { Store } from '../models/Store.js';
import { logger } from '../utils/logger.js';

const DUPLICATE_KEY_ERROR = 11000;

const isDuplicateKeyError = (writeError) =>
  (writeError?.code ?? writeError?.err?.code) === DUPLICATE_KEY_ERROR;

/**
 * Inserts the demo stores when, and only when, the collection is empty.
 *
 * Safe to run on every startup:
 *  - it only ever inserts: existing documents are never updated or deleted;
 *  - it skips entirely once any store (demo or real) exists;
 *  - a unique index on demo stores means two instances starting at the same
 *    moment still end up with exactly one copy: the slower one's inserts are
 *    rejected as duplicates, which is treated as success.
 */
export async function seedStoresIfEmpty() {
  // Idempotent. The unique seed index must exist before the first insert.
  await Store.createIndexes();

  const existing = await Store.exists({});
  if (existing) {
    logger.info('Seed skipped: stores collection is not empty');
    return { seeded: false, inserted: 0 };
  }

  let inserted = 0;
  try {
    // Unordered, so one rejected document does not stop the others.
    // insertMany runs the schema validators on the seed data.
    const documents = await Store.insertMany(DEMO_STORES, { ordered: false });
    inserted = documents.length;
  } catch (error) {
    // A concurrent seeder won the race for some or all documents.
    const writeErrors = error?.writeErrors ?? [];
    if (writeErrors.length === 0 || !writeErrors.every(isDuplicateKeyError)) throw error;
    inserted = error.insertedDocs?.length ?? 0;
  }

  logger.info(`Seed complete: inserted ${inserted} demo store(s)`);
  return { seeded: inserted > 0, inserted };
}
