import { z } from 'zod';
import { API_BASE_URL } from '@/lib/env';
import type { Store, StoresResult } from '@/types/store';

const REQUEST_TIMEOUT_MS = 10_000;

export type StoresApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid_response';

export class StoresApiError extends Error {
  readonly kind: StoresApiErrorKind;
  readonly status?: number;

  constructor(kind: StoresApiErrorKind, status?: number) {
    super(
      status === undefined
        ? `Stores request failed: ${kind}`
        : `Stores request failed: ${kind} ${status}`,
    );
    this.name = 'StoresApiError';
    this.kind = kind;
    this.status = status;
  }
}

// z.number() already rejects NaN and Infinity.
const storeSchema: z.ZodType<Store> = z.object({
  _id: z.string().min(1),
  name: z.string().trim().min(1),
  source: z.string().trim().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const storesEnvelopeSchema = z
  .object({
    success: z.literal(true),
    count: z.number().int().nonnegative(),
    data: z.array(z.unknown()),
  })
  // A count that disagrees with the list means the payload was cut short or
  // assembled wrongly; showing part of it as if it were everything is worse
  // than reporting the error.
  .refine((envelope) => envelope.count === envelope.data.length);

/**
 * Validates an API payload. The response is never trusted: a malformed
 * envelope is an error, while individual bad records (out-of-range
 * coordinates, missing names, duplicate ids) are dropped and counted so one
 * broken row cannot take the whole map down.
 */
export function parseStoresResponse(payload: unknown): StoresResult {
  const envelope = storesEnvelopeSchema.safeParse(payload);
  if (!envelope.success) {
    throw new StoresApiError('invalid_response');
  }

  const stores: Store[] = [];
  const seenIds = new Set<string>();
  let skippedCount = 0;

  for (const record of envelope.data.data) {
    const parsed = storeSchema.safeParse(record);
    if (!parsed.success || seenIds.has(parsed.data._id)) {
      skippedCount += 1;
      continue;
    }
    seenIds.add(parsed.data._id);
    stores.push(parsed.data);
  }

  return { stores, skippedCount };
}

/**
 * Loads all stores. Rejects with a StoresApiError, or with the original
 * AbortError when the caller's signal aborted the request.
 */
export async function fetchStores(signal?: AbortSignal): Promise<StoresResult> {
  // One controller serves both the caller's cancellation and our own timeout.
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();

  if (signal?.aborted) forwardAbort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/stores`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new StoresApiError(timedOut ? 'timeout' : 'network');
    }

    if (!response.ok) {
      throw new StoresApiError('http', response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new StoresApiError(timedOut ? 'timeout' : 'invalid_response');
    }

    return parseStoresResponse(payload);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
