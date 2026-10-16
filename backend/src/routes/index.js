import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';
import { methodNotAllowed } from '../middleware/guards.js';
import { storeRoutes } from './storeRoutes.js';

/**
 * Health check, mounted at /api/health outside the rate limiter: uptime
 * monitors and orchestrator probes poll it far more often than a client would.
 */
export const healthRoutes = Router();

healthRoutes
  .route('/')
  .get(getHealth)
  .all(methodNotAllowed(['GET', 'HEAD']));

/**
 * Root of the public API (mounted at /api, behind the rate limiter).
 * New resources (couriers, orders, zones) get their own router file here.
 */
export const apiRoutes = Router();

apiRoutes.use('/stores', storeRoutes);
