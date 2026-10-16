'use client';

import L, {
  type LatLngTuple,
  type LeafletEvent,
  type Map as LeafletMap,
  type Popup as LeafletPopup,
} from 'leaflet';
import { LocateFixed, Maximize, TriangleAlert } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { MapContainer, Popup, ScaleControl, TileLayer, ZoomControl } from 'react-leaflet';
import {
  DEFAULT_ZOOM,
  FOCUS_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  OSM_TILE_URL,
  TASHKENT_CENTER,
} from '@/lib/constants';
import { messages, sourceLabel } from '@/lib/messages';
import type { Store } from '@/types/store';
import { formatCoordinate } from '@/utils/format';
import { MapResizeObserver, SelectionCamera } from './mapBehaviors';
import { SELECTED_PIN_HEIGHT } from './markerIcon';
import { StoreMarker } from './StoreMarker';

export interface MapViewProps {
  /** Stores to draw: already validated and filtered by the dashboard. */
  stores: readonly Store[];
  selectedStore: Store | null;
  focusNonce: number;
  reducedMotion: boolean;
  onSelect: (storeId: string) => void;
}

const POPUP_OFFSET: [number, number] = [0, -(SELECTED_PIN_HEIGHT - 6)];
const FIT_PADDING: [number, number] = [56, 56];

// Share of tiles that must fail in one load before the map is reported as
// broken. A single missing tile is not worth a warning.
const TILE_FAILURE_THRESHOLD = 0.25;

const TOOL_BUTTON_CLASS =
  'flex h-10 w-10 items-center justify-center bg-surface text-ink transition-colors hover:bg-surface-muted hover:text-primary focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-surface';

function localizePopupCloseButton(event: LeafletEvent) {
  const popup = event.target as LeafletPopup;
  popup
    .getElement()
    ?.querySelector('.leaflet-popup-close-button')
    ?.setAttribute('aria-label', messages.map.closePopup);
}

const POPUP_EVENT_HANDLERS = { add: localizePopupCloseButton };

/**
 * The Leaflet map. Browser-only: it is loaded through `next/dynamic` with
 * `ssr: false` (see MapPanel) and must not be imported from server code.
 */
export default function MapView({
  stores,
  selectedStore,
  focusNonce,
  reducedMotion,
  onSelect,
}: MapViewProps) {
  // The Leaflet instance, for controls rendered outside the map container.
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const tileCounts = useRef({ loaded: 0, failed: 0 });

  // Tile results are tallied per load cycle (`loading` ... `load`) and judged
  // once the cycle ends, so the warning neither flickers with every tile nor
  // disappears because one cached tile happened to arrive.
  const tileEventHandlers = useMemo(
    () => ({
      loading: () => {
        tileCounts.current = { loaded: 0, failed: 0 };
      },
      tileload: () => {
        tileCounts.current.loaded += 1;
      },
      tileerror: () => {
        tileCounts.current.failed += 1;
      },
      load: () => {
        const { loaded, failed } = tileCounts.current;
        setTilesFailed(failed > 0 && failed >= (loaded + failed) * TILE_FAILURE_THRESHOLD);
      },
    }),
    [],
  );

  // A stable array: react-leaflet closes and reopens the popup whenever the
  // `position` prop changes identity, which would undo the user closing it.
  const selectedLat = selectedStore?.lat;
  const selectedLng = selectedStore?.lng;
  const popupPosition = useMemo<LatLngTuple | null>(
    () =>
      selectedLat === undefined || selectedLng === undefined ? null : [selectedLat, selectedLng],
    [selectedLat, selectedLng],
  );

  const fitAllStores = useCallback(() => {
    if (!map || stores.length === 0) return;
    const bounds = L.latLngBounds(stores.map((store) => [store.lat, store.lng]));
    map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FOCUS_ZOOM, animate: !reducedMotion });
  }, [map, stores, reducedMotion]);

  const resetView = useCallback(() => {
    map?.setView(TASHKENT_CENTER, DEFAULT_ZOOM, { animate: !reducedMotion });
  }, [map, reducedMotion]);

  return (
    <div className="absolute inset-0">
      <MapContainer
        ref={setMap}
        center={TASHKENT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomControl={false}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          url={OSM_TILE_URL}
          attribution={messages.map.attribution}
          maxZoom={MAX_ZOOM}
          eventHandlers={tileEventHandlers}
        />
        <ZoomControl
          position="bottomright"
          zoomInTitle={messages.map.zoomIn}
          zoomOutTitle={messages.map.zoomOut}
        />
        <ScaleControl position="bottomleft" imperial={false} />
        <MapResizeObserver />
        <SelectionCamera
          lat={selectedStore?.lat ?? null}
          lng={selectedStore?.lng ?? null}
          focusNonce={focusNonce}
          reducedMotion={reducedMotion}
        />

        {stores.map((store) => (
          // The name is part of the key because Leaflet applies a marker's
          // title only when the marker is created: a renamed store gets a
          // fresh marker instead of keeping its old accessible name.
          <StoreMarker
            key={`${store._id}:${store.name}`}
            store={store}
            isSelected={store._id === selectedStore?._id}
            onSelect={onSelect}
          />
        ))}

        {selectedStore && popupPosition ? (
          // One controlled popup for the selected store. The key remounts it on
          // every selection request, which reopens it after the user closed it;
          // nothing else reopens it. autoPan is off because SelectionCamera
          // already frames the marker together with its popup.
          <Popup
            key={`${selectedStore._id}:${focusNonce}`}
            position={popupPosition}
            offset={POPUP_OFFSET}
            autoPan={false}
            eventHandlers={POPUP_EVENT_HANDLERS}
          >
            <div className="px-3.5 py-3 pr-9">
              <p className="font-display text-base leading-5 font-semibold text-ink">
                {selectedStore.name}
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                <dt className="text-muted">{messages.store.source}</dt>
                <dd>{sourceLabel(selectedStore.source)}</dd>
                <dt className="text-muted">{messages.store.latitude}</dt>
                <dd className="tabular-nums">{formatCoordinate(selectedStore.lat)}</dd>
                <dt className="text-muted">{messages.store.longitude}</dt>
                <dd className="tabular-nums">{formatCoordinate(selectedStore.lng)}</dd>
              </dl>
            </div>
          </Popup>
        ) : null}
      </MapContainer>

      <div className="absolute top-3 right-3 z-10 flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line-strong shadow-(--shadow-control)">
        <button
          type="button"
          onClick={fitAllStores}
          disabled={!map || stores.length === 0}
          aria-label={messages.map.fitAll}
          title={messages.map.fitAll}
          className={TOOL_BUTTON_CLASS}
        >
          <Maximize size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={resetView}
          disabled={!map}
          aria-label={messages.map.resetView}
          title={messages.map.resetView}
          className={TOOL_BUTTON_CLASS}
        >
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      </div>

      {tilesFailed ? (
        // Above the scale bar, clear of the zoom buttons, and never in the way of the map.
        <div className="pointer-events-none absolute right-16 bottom-10 left-3 z-10 flex">
          <p
            role="status"
            className="flex items-start gap-2 rounded border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning shadow-(--shadow-control)"
          >
            <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            {messages.map.tilesFailed}
          </p>
        </div>
      ) : null}
    </div>
  );
}
