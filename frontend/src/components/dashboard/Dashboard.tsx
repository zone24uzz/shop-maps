'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { AppHeader, type ConnectionStatus } from '@/components/dashboard/AppHeader';
import { type LoadStatus, SummaryStrip } from '@/components/dashboard/SummaryStrip';
import type { MapNoticeData } from '@/components/map/MapNotice';
import { MapPanel } from '@/components/map/MapPanel';
import { SearchPanel } from '@/components/stores/SearchPanel';
import { StoreList } from '@/components/stores/StoreList';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { type StoresData, useStores } from '@/hooks/useStores';
import { DEMO_SOURCE } from '@/lib/constants';
import { describeStoresError, messages, staleDataLabel } from '@/lib/messages';
import type { StoresApiError } from '@/services/storesApi';
import type { Store } from '@/types/store';
import { formatClockTime } from '@/utils/format';
import { filterStores } from '@/utils/search';

const NO_STORES: readonly Store[] = [];

interface Selection {
  id: string | null;
  /** Bumped on every selection request so the map refocuses even on the same store. */
  nonce: number;
}

function getConnectionStatus(
  data: StoresData | null,
  error: StoresApiError | null,
): ConnectionStatus {
  if (!error) return data ? 'online' : 'connecting';
  // The API answered, just not with what we need: that is not "no connection".
  return error.kind === 'network' || error.kind === 'timeout' ? 'offline' : 'error';
}

function getMapNotice(
  data: StoresData | null,
  error: StoresApiError | null,
  visibleCount: number,
  onRetry: () => void,
): MapNoticeData | null {
  const retry = { label: messages.list.retry, onClick: onRetry };

  if (!data) {
    return error
      ? { tone: 'danger', message: messages.map.loadFailed, action: retry }
      : { tone: 'info', message: messages.map.storesLoading, busy: true };
  }
  if (error) {
    // A refresh failed: the previous result stays on screen, labelled as stale.
    // Announced, because this notice is the only place that says so.
    return {
      tone: 'warning',
      message: staleDataLabel(formatClockTime(data.fetchedAt)),
      announce: true,
      action: retry,
    };
  }
  if (data.stores.length === 0) return { tone: 'info', message: messages.map.noStores };
  if (visibleCount === 0) return { tone: 'info', message: messages.map.noMatch };
  return null;
}

/**
 * Client root of the dashboard. Owns the three pieces of UI state (loaded
 * stores, search query, selection) and derives everything else from them, so
 * the sidebar, the summary and the map can never disagree.
 */
export function Dashboard() {
  const { data, error, isFetching, refresh } = useStores();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>({ id: null, nonce: 0 });
  const reducedMotion = usePrefersReducedMotion();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const stores = data?.stores ?? NO_STORES;

  // When a refresh brings a list without the selected store, forget the
  // selection instead of merely hiding it; otherwise the store would become
  // selected again, and the map would fly to it, if a later refresh brought
  // it back. State is adjusted during render, as React recommends for values
  // that depend on changed inputs, rather than in an effect.
  const [reconciledStores, setReconciledStores] = useState(stores);
  if (stores !== reconciledStores) {
    setReconciledStores(stores);
    if (selection.id !== null && !stores.some((store) => store._id === selection.id)) {
      setSelection({ id: null, nonce: selection.nonce });
    }
  }

  const visibleStores = useMemo(() => filterStores(stores, query), [stores, query]);
  const selectedStore = useMemo(
    () => visibleStores.find((store) => store._id === selection.id) ?? null,
    [visibleStores, selection.id],
  );

  const status: LoadStatus = data ? 'ready' : error ? 'error' : 'loading';
  const isDemo = useMemo(() => stores.some((store) => store.source === DEMO_SOURCE), [stores]);

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    // Filtering out the selected store clears the selection for good, so it
    // does not silently come back when the search is cleared.
    setSelection((current) => {
      if (current.id === null) return current;
      const stillVisible = filterStores(stores, nextQuery).some(
        (store) => store._id === current.id,
      );
      return stillVisible ? current : { id: null, nonce: current.nonce };
    });
  };

  const clearSearchFromList = () => {
    setQuery('');
    // The button that triggered this belongs to the empty state and is about
    // to disappear; continue in the search field.
    searchInputRef.current?.focus();
  };

  // The callbacks below are stable because they reach memoized components
  // (map panel, markers, list rows).
  const selectStore = useCallback((storeId: string) => {
    setSelection((current) => ({ id: storeId, nonce: current.nonce + 1 }));
  }, []);

  const selectStoreFromList = useCallback(
    (storeId: string) => {
      selectStore(storeId);
      // On small screens the list sits below the map: bring the map back into view.
      const mapPanel = document.getElementById('map-panel');
      if (mapPanel && mapPanel.getBoundingClientRect().top < 0) {
        mapPanel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
    },
    [selectStore, reducedMotion],
  );

  const clearSelection = useCallback(() => {
    setSelection((current) => ({ id: null, nonce: current.nonce }));
  }, []);

  const mapNotice = useMemo(
    () => getMapNotice(data, error, visibleStores.length, refresh),
    [data, error, visibleStores.length, refresh],
  );

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <AppHeader
        connection={getConnectionStatus(data, error)}
        isDemo={isDemo}
        lastUpdated={data?.fetchedAt ?? null}
        isFetching={isFetching}
        onRefresh={refresh}
      />

      {/*
        Small screens: one scrolling column, shown as summary, search, map, list.
        Large screens: a fixed sidebar (search + list) beside the main column.
        The two wrappers use `display: contents` below `lg`, which lets their
        children be placed with `order` as direct items of this flex column.

        The DOM (and therefore tab and screen-reader) order is search, list,
        summary, map on every screen size. That is deliberate: a search field
        is followed by its results, and a keyboard user reaches the list
        without first stepping through every control of the map.
      */}
      <main className="flex flex-1 flex-col gap-4 py-4 lg:grid lg:min-h-0 lg:grid-cols-[22.5rem_minmax(0,1fr)] lg:gap-0 lg:py-0">
        <div className="contents lg:flex lg:min-h-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
          <SearchPanel
            inputRef={searchInputRef}
            status={status}
            query={query}
            onQueryChange={handleQueryChange}
            totalCount={stores.length}
            matchCount={visibleStores.length}
            skippedCount={data?.skippedCount ?? 0}
            className="order-2 px-4 lg:border-b lg:border-line lg:py-4"
          />
          <StoreList
            status={status}
            stores={visibleStores}
            totalCount={stores.length}
            query={query}
            selectedId={selectedStore?._id ?? null}
            errorMessage={error ? describeStoresError(error) : null}
            onSelect={selectStoreFromList}
            onClearSearch={clearSearchFromList}
            onRetry={refresh}
            className="order-4 mx-4 overflow-hidden rounded-md border border-line lg:mx-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:rounded-none lg:border-0"
          />
        </div>

        <div className="contents lg:flex lg:min-h-0 lg:flex-col lg:gap-4 lg:p-4">
          <SummaryStrip
            status={status}
            totalCount={stores.length}
            visibleCount={visibleStores.length}
            selectedName={selectedStore?.name ?? null}
            className="order-1 px-4 lg:px-0"
          />
          <MapPanel
            stores={visibleStores}
            selectedStore={selectedStore}
            focusNonce={selection.nonce}
            reducedMotion={reducedMotion}
            notice={mapNotice}
            onSelect={selectStore}
            onClearSelection={clearSelection}
            className="order-3 px-4 lg:px-0"
          />
        </div>
      </main>
    </div>
  );
}
