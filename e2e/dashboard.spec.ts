import { expect, type Page, test } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';

const TASHKENT_CENTER = { lat: 41.311081, lng: 69.240562 };
const DEFAULT_ZOOM = 12;
const FOCUS_ZOOM = 15;

/** Path of the OpenStreetMap tile that contains a coordinate at a zoom level. */
function tilePath(lat: number, lng: number, zoom: number): string {
  const scale = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  );
  return `/${zoom}/${x}/${y}.png`;
}

const loadedTile = (page: Page, path: string) =>
  page.locator(`img.leaflet-tile-loaded[src$="${path}"]`);

interface ApiStore {
  _id: string;
  name: string;
  lat: number;
  lng: number;
}

let apiStores: ApiStore[] = [];

const markers = (page: Page) => page.locator('.store-marker');
const listItems = (page: Page) => page.locator('[data-store-id]');
const popup = (page: Page) => page.locator('.leaflet-popup');
const mapBox = (page: Page) => page.locator('.leaflet-container');

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `e2e/screenshots/${test.info().project.name}-${name}.png`,
    fullPage: true,
  });
}

/** Collects everything the browser reports as an error while a test runs. */
function trackBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test.beforeAll(async ({ request }) => {
  // `npm run dev` starts the API after the database; wait until it answers.
  await expect
    .poll(async () => (await request.get(`${API_URL}/api/health`).catch(() => null))?.status(), {
      timeout: 90_000,
    })
    .toBe(200);

  const response = await request.get(`${API_URL}/api/stores`);
  apiStores = (await response.json()).data;
  expect(apiStores.length, 'the database must contain stores (demo seed)').toBeGreaterThan(0);
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(markers(page)).toHaveCount(apiStores.length);
  // The basemap is on screen before any interaction starts.
  await expect(
    loadedTile(page, tilePath(TASHKENT_CENTER.lat, TASHKENT_CENTER.lng, DEFAULT_ZOOM)),
  ).toBeVisible();
});

test('loads without console errors or hydration warnings', async ({ page }) => {
  const errors = trackBrowserErrors(page);
  await page.reload();

  await expect(page.getByRole('heading', { level: 1, name: 'Logistics Map' })).toBeVisible();
  await expect(markers(page)).toHaveCount(apiStores.length);
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  // Give late warnings (hydration, effects) a moment to surface.
  await page.waitForTimeout(1000);

  expect(errors).toEqual([]);
  await screenshot(page, '01-loaded');
});

test('shows OpenStreetMap tiles centred on Tashkent at zoom 12', async ({ page }) => {
  const centreTile = loadedTile(
    page,
    tilePath(TASHKENT_CENTER.lat, TASHKENT_CENTER.lng, DEFAULT_ZOOM),
  );
  await expect(centreTile).toHaveCount(1);
  await expect(centreTile).toHaveAttribute('src', /tile\.openstreetmap\.org/);

  // Every tile on screen belongs to zoom level 12.
  const sources = await page
    .locator('img.leaflet-tile-loaded')
    .evaluateAll((tiles) => tiles.map((tile) => (tile as HTMLImageElement).src));
  expect(sources.length).toBeGreaterThan(3);
  expect(sources.every((src) => /\/12\/\d+\/\d+\.png$/.test(src))).toBe(true);

  await expect(page.locator('.leaflet-control-zoom-in')).toBeVisible();
  await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
});

test('draws one marker per store returned by the API', async ({ page }) => {
  await expect(markers(page)).toHaveCount(apiStores.length);
  await expect(listItems(page)).toHaveCount(apiStores.length);

  for (const store of apiStores) {
    await expect(page.locator(`.store-marker[title="${store.name}"]`)).toHaveCount(1);
  }
  await expect(page.getByText(`Jami ${apiStores.length} ta do‘kon`)).toBeVisible();
});

test('opens a popup with the store details when a marker is clicked', async ({ page }) => {
  const store = apiStores[0]!;
  await expect(popup(page)).toHaveCount(0);

  await page.locator(`.store-marker[title="${store.name}"]`).click();

  await expect(popup(page)).toBeVisible();
  await expect(popup(page)).toContainText(store.name);
  await expect(popup(page)).toContainText('Manba');
  await expect(popup(page)).toContainText(store.lat.toFixed(5));
  await expect(popup(page)).toContainText(store.lng.toFixed(5));

  // The camera focused on the store: its map tile at the focus zoom is on screen.
  await expect(loadedTile(page, tilePath(store.lat, store.lng, FOCUS_ZOOM))).toBeVisible();

  // The same store is now selected in the list and in the summary.
  await expect(listItems(page).filter({ hasText: store.name }).getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.store-marker.is-selected')).toHaveCount(1);
  await screenshot(page, '02-marker-popup');
});

test('selecting a store in the list moves the map to it', async ({ page }) => {
  const store = apiStores[apiStores.length - 1]!;
  const storeTile = loadedTile(page, tilePath(store.lat, store.lng, FOCUS_ZOOM));
  await expect(storeTile).toHaveCount(0);

  await listItems(page).filter({ hasText: store.name }).getByRole('button').click();

  await expect(popup(page)).toContainText(store.name);
  // The camera left the city overview (zoom 12) and now shows the store's
  // own surroundings at the focus zoom.
  await expect(storeTile).toBeVisible();
  await expect(page.locator(`img.leaflet-tile[src*="/${DEFAULT_ZOOM}/"]`)).toHaveCount(0);

  // The selected marker and its popup are inside the visible map area.
  const selected = page.locator('.store-marker.is-selected');
  await expect(selected).toHaveAttribute('title', store.name);
  await expect(selected).toBeInViewport({ ratio: 1 });
  await expect(popup(page)).toBeInViewport({ ratio: 1 });

  const box = (await mapBox(page).boundingBox())!;
  const pin = (await selected.boundingBox())!;
  expect(pin.x).toBeGreaterThan(box.x);
  expect(pin.x + pin.width).toBeLessThan(box.x + box.width);
  expect(pin.y).toBeGreaterThan(box.y);
  expect(pin.y + pin.height).toBeLessThan(box.y + box.height);

  await screenshot(page, '03-list-selection');
});

test('search filters the list and the map', async ({ page }) => {
  const target = apiStores[0]!;
  // The distinctive part of a demo name, e.g. "Chilonzor".
  const term = target.name.split(/[:\s]+/).pop()!;
  const search = page.getByRole('searchbox');

  await search.fill(term.toUpperCase());
  const expected = apiStores.filter((store) =>
    store.name.toLowerCase().includes(term.toLowerCase()),
  ).length;
  await expect(listItems(page)).toHaveCount(expected);
  await expect(markers(page)).toHaveCount(expected);
  await expect(
    page.getByText(`${apiStores.length} ta do‘kondan ${expected} tasi mos keldi`),
  ).toBeVisible();
  await screenshot(page, '04-search');

  await search.fill('zzz-no-such-store');
  await expect(listItems(page)).toHaveCount(0);
  await expect(markers(page)).toHaveCount(0);
  await expect(page.getByText('Qidiruvga mos do‘kon topilmadi.')).toBeVisible();
  // Filtering redraws markers only; the basemap stays in place.
  await expect(
    loadedTile(page, tilePath(TASHKENT_CENTER.lat, TASHKENT_CENTER.lng, DEFAULT_ZOOM)),
  ).toBeVisible();
  await screenshot(page, '05-no-match');

  await page.getByRole('button', { name: 'Qidiruvni tozalash' }).first().click();
  await expect(search).toHaveValue('');
  await expect(listItems(page)).toHaveCount(apiStores.length);
  await expect(markers(page)).toHaveCount(apiStores.length);
});

test('layout fits the viewport without horizontal overflow', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const box = (await mapBox(page).boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.height).toBeGreaterThanOrEqual(300);
  expect(box.width).toBeLessThanOrEqual(viewport.width);

  // The list is reachable and its rows are large enough to tap.
  const firstRow = listItems(page).first().getByRole('button');
  await firstRow.scrollIntoViewIfNeeded();
  await expect(firstRow).toBeVisible();
  expect((await firstRow.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('map can be zoomed and dragged', async ({ page }) => {
  const mapPane = page.locator('.leaflet-map-pane');

  await page.locator('.leaflet-control-zoom-in').click();
  await expect(page.locator('img.leaflet-tile-loaded[src*="/13/"]').first()).toBeVisible();

  const before = await mapPane.evaluate((pane) => pane.style.transform);
  const box = (await mapBox(page).boundingBox())!;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 120, startY - 60, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => mapPane.evaluate((pane) => pane.style.transform)).not.toBe(before);
});

test('shows an error with a working retry when the API is unreachable', async ({ page }) => {
  await page.route('**/api/stores', (route) => route.abort('connectionrefused'));
  await page.reload();

  await expect(page.getByText('Do‘konlar ro‘yxatini yuklab bo‘lmadi')).toBeVisible();
  await expect(page.getByText('API bilan aloqa yo‘q')).toBeAttached();
  await expect(markers(page)).toHaveCount(0);
  // The map itself still works without store data.
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await screenshot(page, '06-error');

  await page.unroute('**/api/stores');
  await page.getByRole('button', { name: 'Qayta urinish' }).first().click();

  await expect(markers(page)).toHaveCount(apiStores.length);
  await expect(page.getByText('Do‘konlar ro‘yxatini yuklab bo‘lmadi')).toHaveCount(0);
});
