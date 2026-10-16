import { isDatabaseReady } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

export function getHealth(_req, res) {
  if (!isDatabaseReady()) {
    throw AppError.serviceUnavailable('DATABASE_UNAVAILABLE', 'Database is not available');
  }
  res.json({ success: true, status: 'ok' });
}
