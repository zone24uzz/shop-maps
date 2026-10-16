import { Store } from '../models/Store.js';
import { AppError } from '../utils/AppError.js';

// Upper bound for a single list response. Pagination replaces this cap once
// the catalogue grows beyond what one map view can reasonably show.
const MAX_STORES_PER_RESPONSE = 1000;

const PUBLIC_FIELDS = '_id name source lat lng createdAt updatedAt';

/** Explicit allow-list mapping: internal fields can never leak by accident. */
function toPublicStore(doc) {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    source: doc.source,
    lat: doc.lat,
    lng: doc.lng,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listStores() {
  const docs = await Store.find({})
    .select(PUBLIC_FIELDS)
    .sort({ name: 1, _id: 1 })
    .limit(MAX_STORES_PER_RESPONSE)
    .lean();

  return docs.map(toPublicStore);
}

export async function getStoreById(id) {
  const doc = await Store.findById(id).select(PUBLIC_FIELDS).lean();
  if (!doc) {
    throw AppError.notFound('STORE_NOT_FOUND', 'Store not found');
  }
  return toPublicStore(doc);
}
