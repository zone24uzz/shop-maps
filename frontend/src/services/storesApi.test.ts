import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_STORES, jsonResponse, storesPayload } from '@/test/fixtures';
import { fetchStores, parseStoresResponse, StoresApiError } from './storesApi';

const valid = DEMO_STORES[0]!;

describe('parseStoresResponse', () => {
  it('accepts a well-formed response', () => {
    expect(parseStoresResponse(storesPayload())).toEqual({
      stores: DEMO_STORES,
      skippedCount: 0,
    });
  });

  it('accepts an empty list', () => {
    expect(parseStoresResponse(storesPayload([]))).toEqual({ stores: [], skippedCount: 0 });
  });

  it('drops invalid records and counts them', () => {
    const records = [
      valid,
      { ...valid, _id: 'a', lat: 91 },
      { ...valid, _id: 'b', lat: -90.5 },
      { ...valid, _id: 'c', lng: 181 },
      { ...valid, _id: 'd', lng: '69.2' },
      { ...valid, _id: 'e', lat: Number.NaN },
      { ...valid, _id: 'f', lng: null },
      { ...valid, _id: 'g', name: '   ' },
      { ...valid, _id: 'h', source: undefined },
      { ...valid, _id: '' },
      { ...valid, _id: 'i', createdAt: 'yesterday' },
      { ...valid, _id: 'j', updatedAt: 1736928000000 },
      { name: 'No coordinates' },
      null,
      'store',
      42,
    ];

    const result = parseStoresResponse(storesPayload(records));

    expect(result.stores).toEqual([valid]);
    expect(result.skippedCount).toBe(records.length - 1);
  });

  it('keeps the coordinate boundaries', () => {
    const edge = { ...valid, lat: -90, lng: 180 };
    expect(parseStoresResponse(storesPayload([edge])).stores).toEqual([edge]);
  });

  it('drops records that repeat an id', () => {
    const result = parseStoresResponse(storesPayload([valid, { ...valid, name: 'Copy' }]));
    expect(result.stores).toEqual([valid]);
    expect(result.skippedCount).toBe(1);
  });

  it('strips fields the UI does not know about', () => {
    const result = parseStoresResponse(storesPayload([{ ...valid, internalNote: 'secret' }]));
    expect(result.stores[0]).not.toHaveProperty('internalNote');
  });

  it.each([
    ['null', null],
    ['a string', 'ok'],
    ['an array', [valid]],
    ['a failure envelope', { success: false, error: { code: 'X', message: 'x' } }],
    ['a missing data field', { success: true, count: 0 }],
    ['data that is not an array', { success: true, count: 1, data: valid }],
    ['a missing count', { success: true, data: [valid] }],
    ['a count that disagrees with the list', { success: true, count: 5, data: [valid] }],
  ])('rejects %s as an invalid response', (_label, payload) => {
    expect(() => parseStoresResponse(payload)).toThrowError(
      expect.objectContaining({ kind: 'invalid_response' }),
    );
  });
});

describe('fetchStores', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A request that never answers and rejects only when its signal aborts. */
  function hangUntilAborted() {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
  }

  it('requests the stores endpoint and returns validated stores', async () => {
    fetchMock.mockResolvedValue(jsonResponse(storesPayload()));

    const result = await fetchStores();

    expect(result.stores).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:5000/api/stores');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ cache: 'no-store' });
  });

  it('reports an unreachable server as a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchStores()).rejects.toMatchObject({ kind: 'network' });
    await expect(fetchStores()).rejects.toBeInstanceOf(StoresApiError);
  });

  it.each([404, 429, 500, 503])('reports HTTP %i with its status', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false }, status));
    await expect(fetchStores()).rejects.toMatchObject({ kind: 'http', status });
  });

  it('reports a body that is not JSON as an invalid response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response);

    await expect(fetchStores()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('gives up with a timeout error when the server does not answer', async () => {
    vi.useFakeTimers();
    hangUntilAborted();

    const outcome = expect(fetchStores()).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(10_000);
    await outcome;
  });

  it('passes the caller abort through instead of reporting an API error', async () => {
    hangUntilAborted();
    const controller = new AbortController();

    const request = fetchStores(controller.signal);
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('hands an already aborted signal to fetch, which then rejects as aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    // Like the real fetch: refuses to start when its signal is already aborted.
    fetchMock.mockImplementation((_input, init) =>
      init?.signal?.aborted
        ? Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
        : Promise.resolve(jsonResponse(storesPayload())),
    );

    await expect(fetchStores(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(true);
  });

  it('stops its timeout timer once the request has settled', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse(storesPayload()));

    await fetchStores();

    expect(vi.getTimerCount()).toBe(0);
  });
});
