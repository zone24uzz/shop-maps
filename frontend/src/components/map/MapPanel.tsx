'use client';

import dynamic from 'next/dynamic';
import { memo } from 'react';
import { messages } from '@/lib/messages';
import type { Store } from '@/types/store';
import { cn } from '@/utils/cn';
import { MapNotice, type MapNoticeData } from './MapNotice';
import { SelectedStoreBar } from './SelectedStoreBar';

function MapLoading() {
  return (
    <div
      role="status"
      className="absolute inset-0 flex animate-pulse items-center justify-center bg-surface-muted text-sm text-muted"
    >
      {messages.map.loading}
    </div>
  );
}

// Leaflet reads `window` as soon as it is imported, so the map must never be
// part of the server render. `ssr: false` is only allowed in a Client
// Component, which is why this file has its own 'use client' boundary.
// The import also keeps Leaflet in a separate chunk, off the critical path.
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: MapLoading,
});

interface MapPanelProps {
  stores: readonly Store[];
  selectedStore: Store | null;
  focusNonce: number;
  reducedMotion: boolean;
  notice: MapNoticeData | null;
  onSelect: (storeId: string) => void;
  onClearSelection: () => void;
  className?: string;
}

function MapPanelComponent({
  stores,
  selectedStore,
  focusNonce,
  reducedMotion,
  notice,
  onSelect,
  onClearSelection,
  className,
}: MapPanelProps) {
  return (
    <section
      id="map-panel"
      aria-label={messages.map.regionLabel}
      className={cn('flex scroll-mt-16 flex-col gap-3 lg:min-h-0 lg:flex-1', className)}
    >
      {/* Fixed height on small screens (the page scrolls); fills the column on large ones. */}
      <div className="relative h-[56svh] max-h-[34rem] min-h-80 overflow-hidden rounded-md border border-line bg-surface-muted lg:h-auto lg:max-h-none lg:min-h-0 lg:flex-1">
        <MapView
          stores={stores}
          selectedStore={selectedStore}
          focusNonce={focusNonce}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
        {notice ? (
          // Leaves room for the map tools in the top-right corner.
          <div className="pointer-events-none absolute top-3 right-16 left-3 z-10 flex">
            <div className="pointer-events-auto max-w-md">
              <MapNotice {...notice} />
            </div>
          </div>
        ) : null}
      </div>

      <SelectedStoreBar store={selectedStore} onClear={onClearSelection} />
    </section>
  );
}

// The dashboard also re-renders for reasons the map does not care about, such
// as a refresh starting. With stable props from Dashboard those are skipped.
export const MapPanel = memo(MapPanelComponent);
