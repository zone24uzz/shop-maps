import type { LatLngTuple } from 'leaflet';

export const TASHKENT_CENTER: LatLngTuple = [41.311081, 69.240562];
export const DEFAULT_ZOOM = 12;

/** Minimum zoom used when the camera focuses on a single store. */
export const FOCUS_ZOOM = 15;
export const MIN_ZOOM = 4;
export const MAX_ZOOM = 19;

/** Must match DEMO_SOURCE in backend/src/data/demoStores.js. */
export const DEMO_SOURCE = 'demo-seed';

export const CURRENT_CITY = 'Toshkent';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
