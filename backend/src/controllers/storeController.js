import * as storeService from '../services/storeService.js';

// Express 5 forwards rejected promises from async handlers to the error
// middleware, so no try/catch or wrapper is needed here.

export async function listStores(_req, res) {
  const stores = await storeService.listStores();
  res.json({ success: true, count: stores.length, data: stores });
}

export async function getStore(req, res) {
  const store = await storeService.getStoreById(req.params.id);
  res.json({ success: true, data: store });
}
