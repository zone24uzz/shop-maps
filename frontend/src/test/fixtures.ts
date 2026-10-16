import type { Store } from '@/types/store';

const TIMESTAMP = '2026-01-15T08:00:00.000Z';

function demoStore(index: number, district: string, lat: number, lng: number): Store {
  return {
    _id: `65a000000000000000000${String(index).padStart(3, '0')}`,
    name: `Demo do‘kon: ${district}`,
    source: 'demo-seed',
    lat,
    lng,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

/** The five demo stores, in the name order the API returns them. */
export const DEMO_STORES: readonly Store[] = [
  demoStore(1, 'Chilonzor', 41.2756, 69.2034),
  demoStore(2, 'Mirzo Ulug‘bek', 41.3256, 69.329),
  demoStore(3, 'Sergeli', 41.2265, 69.2197),
  demoStore(4, 'Yakkasaroy', 41.2853, 69.2493),
  demoStore(5, 'Yunusobod', 41.3672, 69.2889),
];

export function storesPayload(data: readonly unknown[] = DEMO_STORES) {
  return { success: true, count: data.length, data };
}

/** Minimal stand-in for a fetch Response carrying JSON. */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}
