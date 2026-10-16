import { useCallback, useEffect, useReducer } from 'react';
import { fetchStores, StoresApiError } from '@/services/storesApi';
import type { Store } from '@/types/store';

export interface StoresData {
  stores: readonly Store[];
  skippedCount: number;
  fetchedAt: Date;
}

interface StoresState {
  /** Last successful result. Kept on screen while a refresh runs or fails. */
  data: StoresData | null;
  /** Failure of the most recent request, cleared by the next success. */
  error: StoresApiError | null;
  isFetching: boolean;
  /** Incremented to start a new request. */
  requestId: number;
}

type StoresAction =
  | { type: 'refresh' }
  | { type: 'success'; data: StoresData }
  | { type: 'failure'; error: StoresApiError };

const initialState: StoresState = { data: null, error: null, isFetching: true, requestId: 0 };

function reducer(state: StoresState, action: StoresAction): StoresState {
  switch (action.type) {
    case 'refresh':
      // A request is already running; starting another would only duplicate it.
      if (state.isFetching) return state;
      return {
        ...state,
        isFetching: true,
        // Without data the error screen gives way to the loading state.
        error: state.data ? state.error : null,
        requestId: state.requestId + 1,
      };
    case 'success':
      return { ...state, data: action.data, error: null, isFetching: false };
    case 'failure':
      return { ...state, error: action.error, isFetching: false };
  }
}

function toStoresApiError(error: unknown): StoresApiError {
  return error instanceof StoresApiError ? error : new StoresApiError('network');
}

export interface UseStoresResult {
  data: StoresData | null;
  error: StoresApiError | null;
  isFetching: boolean;
  /** Starts a new request (manual refresh and retry). */
  refresh: () => void;
}

/**
 * Loads the store list once on mount and again on every `refresh()`.
 * Each request owns an AbortController, so a response that arrives after
 * unmount or after a newer request never touches state.
 */
export function useStores(): UseStoresResult {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const controller = new AbortController();

    fetchStores(controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'success', data: { ...result, fetchedAt: new Date() } });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'failure', error: toStoresApiError(error) });
      },
    );

    return () => controller.abort();
  }, [state.requestId]);

  const refresh = useCallback(() => dispatch({ type: 'refresh' }), []);

  return { data: state.data, error: state.error, isFetching: state.isFetching, refresh };
}
