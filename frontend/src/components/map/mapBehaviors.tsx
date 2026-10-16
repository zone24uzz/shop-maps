import L from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { FOCUS_ZOOM } from '@/lib/constants';

interface SelectionCameraProps {
  /** Position of the selected store, or null when nothing is selected. */
  lat: number | null;
  lng: number | null;
  /** Changes on every selection request, including re-selecting the same store. */
  focusNonce: number;
  reducedMotion: boolean;
}

// Vertical room kept above the marker so its popup fits inside the viewport.
const MAX_POPUP_CLEARANCE_PX = 90;

/**
 * Moves the camera to the selected store. Depends on coordinates rather than
 * on the store object, so a data refresh that returns the same store does
 * not replay the animation.
 */
export function SelectionCamera({ lat, lng, focusNonce, reducedMotion }: SelectionCameraProps) {
  const map = useMap();

  useEffect(() => {
    if (lat === null || lng === null) return;

    const position = L.latLng(lat, lng);
    // Rounded: while a previous flyTo is still running, getZoom() returns the
    // interpolated fractional zoom, and flying to that would leave the map
    // resting between zoom levels with blurry tiles.
    const zoom = Math.max(Math.round(map.getZoom()), FOCUS_ZOOM);
    const size = map.getSize();

    // A map with no layout yet (hidden container) cannot project pixels.
    if (size.x === 0 || size.y === 0) {
      map.setView(position, zoom, { animate: false });
      return;
    }

    const clearance = Math.min(MAX_POPUP_CLEARANCE_PX, size.y / 4);
    const center = map.unproject(map.project(position, zoom).subtract([0, clearance]), zoom);

    if (reducedMotion) {
      map.setView(center, zoom, { animate: false });
    } else {
      map.flyTo(center, zoom, { duration: 0.8 });
    }
  }, [map, lat, lng, focusNonce, reducedMotion]);

  return null;
}

/**
 * Leaflet caches its container size. When the panel is resized (window
 * resize, orientation change, layout breakpoints) the cache must be
 * refreshed, otherwise tiles are missing from the newly exposed area.
 */
export function MapResizeObserver() {
  const map = useMap();

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(map.getContainer());

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

  return null;
}
