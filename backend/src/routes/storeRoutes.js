import { Router } from 'express';
import { getStore, listStores } from '../controllers/storeController.js';
import { methodNotAllowed, requireDatabase, validateObjectIdParam } from '../middleware/guards.js';

const READ_ONLY = ['GET', 'HEAD'];

export const storeRoutes = Router();

storeRoutes.route('/').get(requireDatabase, listStores).all(methodNotAllowed(READ_ONLY));

storeRoutes
  .route('/:id')
  .get(validateObjectIdParam('id'), requireDatabase, getStore)
  .all(methodNotAllowed(READ_ONLY));
