import type { LatLngTuple, LeafletKeyboardEvent } from 'leaflet';
import { memo, useMemo } from 'react';
import { Marker } from 'react-leaflet';
import type { Store } from '@/types/store';
import { selectedStoreIcon, storeIcon } from './markerIcon';

interface StoreMarkerProps {
  store: Store;
  isSelected: boolean;
  onSelect: (storeId: string) => void;
}

function StoreMarkerComponent({ store, isSelected, onSelect }: StoreMarkerProps) {
  // Stable references: react-leaflet only touches the Leaflet layer when a
  // prop identity changes.
  const position = useMemo<LatLngTuple>(() => [store.lat, store.lng], [store.lat, store.lng]);
  const eventHandlers = useMemo(
    () => ({
      click: () => onSelect(store._id),
      // Leaflet makes the marker a focusable button but only wires Enter up
      // for popups bound with bindPopup. The popup here is controlled by the
      // selection instead, so keyboard activation is handled explicitly.
      keydown: (event: LeafletKeyboardEvent) => {
        const { key } = event.originalEvent;
        if (key !== 'Enter' && key !== ' ') return;
        // Space would otherwise scroll the page.
        event.originalEvent.preventDefault();
        onSelect(store._id);
      },
    }),
    [onSelect, store._id],
  );

  return (
    <Marker
      position={position}
      icon={isSelected ? selectedStoreIcon : storeIcon}
      // The marker's accessible name and hover tooltip.
      title={store.name}
      keyboard
      zIndexOffset={isSelected ? 1000 : 0}
      eventHandlers={eventHandlers}
    />
  );
}

export const StoreMarker = memo(StoreMarkerComponent);
