import mongoose from 'mongoose';
import { DEMO_SOURCE } from '../data/demoStores.js';

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      minlength: [1, 'Store name cannot be empty'],
      maxlength: [200, 'Store name is too long'],
    },
    // Where the record came from (e.g. "demo-seed", later "admin", "erp-import").
    source: {
      type: String,
      required: [true, 'Store source is required'],
      trim: true,
      minlength: [1, 'Store source cannot be empty'],
      maxlength: [100, 'Store source is too long'],
    },
    lat: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
    },
    lng: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
    },
  },
  {
    timestamps: true,
    // Unknown fields are rejected instead of being silently dropped.
    strict: 'throw',
    // Command buffering is disabled (see config/database.js), so Mongoose must
    // not try to build indexes at import time, before a connection exists.
    // Indexes are created explicitly at startup by the seed service.
    autoIndex: false,
    autoCreate: false,
  },
);

// Serves the list query, which sorts by name with _id as a stable tie-break.
// The sort pattern must be a prefix of the index for MongoDB to use it.
storeSchema.index({ name: 1, _id: 1 });

// Makes the demo seed idempotent at the database level: the same demo store
// can never be inserted twice, even if two API instances start at once.
// The partial filter keeps real data unconstrained (chains reuse names).
storeSchema.index(
  { source: 1, name: 1 },
  { unique: true, partialFilterExpression: { source: DEMO_SOURCE } },
);

export const Store = mongoose.model('Store', storeSchema);
