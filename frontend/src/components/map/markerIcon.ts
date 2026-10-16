import L from 'leaflet';

/*
 * Store markers are drawn as inline SVG inside a Leaflet DivIcon.
 *
 * This also sidesteps the classic Leaflet-in-a-bundler problem: the default
 * marker resolves its PNG images relative to the CSS file, which breaks once
 * Next.js fingerprints the assets. With no image files there is nothing to
 * resolve. Colours and states are styled in globals.css (`.store-marker`).
 */
const PIN_SVG = `
<svg viewBox="0 0 30 38" aria-hidden="true" focusable="false">
  <path class="pin-body" d="M15 1.5C8 1.5 2.5 6.9 2.5 13.7c0 8.6 10.1 19.9 11.6 21.5a1.2 1.2 0 0 0 1.8 0c1.5-1.6 11.6-12.9 11.6-21.5C27.5 6.9 22 1.5 15 1.5z"/>
  <circle class="pin-dot" cx="15" cy="13.7" r="4.6"/>
</svg>`;

export const storeIcon = L.divIcon({
  className: 'store-marker',
  html: PIN_SVG,
  iconSize: [30, 38],
  iconAnchor: [15, 38],
});

/** Larger and darker, so the selected store reads first among its neighbours. */
export const selectedStoreIcon = L.divIcon({
  className: 'store-marker is-selected',
  html: PIN_SVG,
  iconSize: [38, 48],
  iconAnchor: [19, 48],
});

/** Distance from a marker's map position to the top of the selected pin. */
export const SELECTED_PIN_HEIGHT = 48;
