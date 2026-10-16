import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_STORES } from '@/test/fixtures';
import type { Store } from '@/types/store';
import MapView from './MapView';

// These tests run the real Leaflet against jsdom. jsdom has no layout, so
// they cover what the map draws (markers, popup, controls), not where; the
// Playwright suite covers positions, tiles and camera movement.

const CHILONZOR = DEMO_STORES[0]!;
const SERGELI = DEMO_STORES[2]!;

interface RenderOptions {
  stores?: readonly Store[];
  selectedStore?: Store | null;
  focusNonce?: number;
}

function renderMap({
  stores = DEMO_STORES,
  selectedStore = null,
  focusNonce = 0,
}: RenderOptions = {}) {
  const onSelect = vi.fn();
  const props = { reducedMotion: true, onSelect };
  const view = render(
    <MapView stores={stores} selectedStore={selectedStore} focusNonce={focusNonce} {...props} />,
  );
  const update = (next: RenderOptions) =>
    view.rerender(
      <MapView
        stores={next.stores ?? stores}
        selectedStore={next.selectedStore ?? null}
        focusNonce={next.focusNonce ?? focusNonce}
        {...props}
      />,
    );
  const markers = () => Array.from(view.container.querySelectorAll<HTMLElement>('.store-marker'));
  const popup = () => view.container.querySelector('.leaflet-popup');
  return { ...view, onSelect, update, markers, popup };
}

describe('MapView', () => {
  it('renders the Leaflet map with OpenStreetMap tiles at the default view', () => {
    const { container } = renderMap();

    expect(container.querySelector('.leaflet-container')).toBeInTheDocument();
    expect(container.querySelector('.leaflet-control-zoom-in')).toHaveAttribute(
      'title',
      'Yaqinlashtirish',
    );
    expect(container.querySelector('.leaflet-control-scale')).toBeInTheDocument();
    expect(container.querySelector('.leaflet-control-attribution')).toHaveTextContent(
      'OpenStreetMap',
    );
  });

  it('draws one labelled, keyboard-focusable marker per store', () => {
    const { markers } = renderMap();

    expect(markers()).toHaveLength(5);
    expect(markers().map((marker) => marker.title)).toEqual(DEMO_STORES.map((store) => store.name));
    for (const marker of markers()) {
      expect(marker).toHaveAttribute('tabindex', '0');
      expect(marker).toHaveAttribute('role', 'button');
    }
  });

  it('renders without markers when there are no stores', () => {
    const { markers, getByRole } = renderMap({ stores: [] });

    expect(markers()).toHaveLength(0);
    expect(getByRole('button', { name: 'Barcha do‘konlarni ko‘rsatish' })).toBeDisabled();
    expect(getByRole('button', { name: 'Toshkent markaziga qaytish' })).toBeEnabled();
  });

  it('adds and removes markers when the data changes', () => {
    const { markers, update } = renderMap();

    update({ stores: DEMO_STORES.slice(0, 2) });
    expect(markers().map((marker) => marker.title)).toEqual([
      DEMO_STORES[0]!.name,
      DEMO_STORES[1]!.name,
    ]);

    update({ stores: [] });
    expect(markers()).toHaveLength(0);

    update({ stores: DEMO_STORES });
    expect(markers()).toHaveLength(5);
  });

  it('reports the clicked marker', () => {
    const { markers, onSelect } = renderMap();

    fireEvent.click(markers()[2]!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(SERGELI._id);
  });

  it('selects a marker from the keyboard with Enter or Space', () => {
    const { markers, onSelect } = renderMap();
    const marker = markers()[2]!;

    fireEvent.keyDown(marker, { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(SERGELI._id);

    const space = fireEvent.keyDown(marker, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    // fireEvent returns false when the handler called preventDefault (no page scroll).
    expect(space).toBe(false);

    fireEvent.keyDown(marker, { key: 'a' });
    fireEvent.keyDown(marker, { key: 'Tab' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('keeps a popup the user closed shut until the store is selected again', () => {
    const { container, popup, update } = renderMap({ selectedStore: SERGELI, focusNonce: 1 });
    expect(popup()).toBeInTheDocument();

    fireEvent.click(container.querySelector('.leaflet-popup-close-button')!);
    expect(popup()).not.toBeInTheDocument();

    // Unrelated re-renders: same selection, new object identities (as after a refresh).
    update({ selectedStore: { ...SERGELI }, focusNonce: 1 });
    update({ stores: DEMO_STORES.slice(1), selectedStore: { ...SERGELI }, focusNonce: 1 });
    expect(popup()).not.toBeInTheDocument();

    // A new selection request for the same store opens it again.
    update({ selectedStore: SERGELI, focusNonce: 2 });
    expect(popup()).toHaveTextContent(SERGELI.name);
  });

  it('gives a renamed store a marker with the new accessible name', () => {
    const { markers, update } = renderMap({ stores: [CHILONZOR] });

    update({ stores: [{ ...CHILONZOR, name: 'Renamed store' }] });

    expect(markers().map((marker) => marker.title)).toEqual(['Renamed store']);
  });

  it('highlights the selected store and opens its popup', () => {
    const { markers, popup } = renderMap({ selectedStore: SERGELI, focusNonce: 1 });

    const selected = markers().filter((marker) => marker.classList.contains('is-selected'));
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAttribute('title', SERGELI.name);

    expect(popup()).toHaveTextContent(SERGELI.name);
    expect(popup()).toHaveTextContent('Manba');
    expect(popup()).toHaveTextContent('Demo ma’lumot');
    expect(popup()).toHaveTextContent('Kenglik41.22650');
    expect(popup()).toHaveTextContent('Uzunlik69.21970');
    expect(popup()?.querySelector('.leaflet-popup-close-button')).toHaveAttribute(
      'aria-label',
      'Yopish',
    );
  });

  it('moves the popup with the selection and removes it when the selection is cleared', () => {
    const { markers, popup, update } = renderMap({ selectedStore: SERGELI, focusNonce: 1 });

    update({ selectedStore: CHILONZOR, focusNonce: 2 });
    expect(popup()).toHaveTextContent(CHILONZOR.name);
    expect(popup()).not.toHaveTextContent(SERGELI.name);
    expect(markers().filter((marker) => marker.classList.contains('is-selected'))).toHaveLength(1);

    update({ selectedStore: null, focusNonce: 2 });
    expect(popup()).not.toBeInTheDocument();
    expect(markers().some((marker) => marker.classList.contains('is-selected'))).toBe(false);
  });

  it('survives extreme but valid coordinates', () => {
    const edgeStores: Store[] = [
      { ...CHILONZOR, _id: 'north', name: 'North pole', lat: 90, lng: 0 },
      { ...CHILONZOR, _id: 'south', name: 'South pole', lat: -90, lng: 180 },
      { ...CHILONZOR, _id: 'west', name: 'Date line', lat: 0, lng: -180 },
    ];

    const { markers, popup } = renderMap({
      stores: edgeStores,
      selectedStore: edgeStores[1]!,
      focusNonce: 1,
    });

    expect(markers()).toHaveLength(3);
    expect(popup()).toHaveTextContent('South pole');
  });
});
