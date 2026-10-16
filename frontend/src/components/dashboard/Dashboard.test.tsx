import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapViewProps } from '@/components/map/MapView';
import { DEMO_STORES, jsonResponse, storesPayload } from '@/test/fixtures';
import { Dashboard } from './Dashboard';

// Leaflet needs a real layout engine, so the dashboard tests replace the map
// with a stub that exposes what the map was asked to draw. The real map is
// covered by MapView.test.tsx and by the Playwright suite.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapViewStub({ stores, selectedStore, onSelect }: MapViewProps) {
      return (
        <div data-testid="map" data-selected={selectedStore?._id ?? ''}>
          {stores.map((store) => (
            <button key={store._id} data-testid="marker" onClick={() => onSelect(store._id)}>
              {`marker ${store.name}`}
            </button>
          ))}
        </div>
      );
    },
}));

const fetchMock = vi.fn<typeof fetch>();

const CHILONZOR = DEMO_STORES[0]!;
const YUNUSOBOD = DEMO_STORES[4]!;

const storeList = () => screen.getByRole('list');
const listedNames = () =>
  within(storeList())
    .getAllByRole('button')
    .map((button) => button.querySelector('span > span')?.textContent);
const markerCount = () => screen.queryAllByTestId('marker').length;
const rowButton = (name: string) =>
  within(storeList()).getByRole('button', { name: new RegExp(name) });
const summaryValue = (label: string) =>
  screen.getByText(label).closest('div')?.querySelector('dd')?.textContent;

async function renderLoaded(payload: unknown = storesPayload()) {
  fetchMock.mockResolvedValue(jsonResponse(payload));
  const user = userEvent.setup();
  render(<Dashboard />);
  await screen.findByText(/^Jami \d+ ta do‘kon$/);
  return user;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('Dashboard loading', () => {
  it('shows a loading state until the request settles', async () => {
    let resolveRequest: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<Dashboard />);

    expect(screen.getByRole('heading', { level: 1, name: 'Logistics Map' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Do‘konlar yuklanmoqda…' })).toBeInTheDocument();
    expect(screen.getByText('Ulanmoqda…')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(markerCount()).toBe(0);

    resolveRequest(jsonResponse(storesPayload()));

    expect(await screen.findByText('Jami 5 ta do‘kon')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Do‘konlar yuklanmoqda…' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('API ulangan')).toBeInTheDocument();
  });

  it('displays the stores returned by the API in the list, the summary and the map', async () => {
    await renderLoaded();

    expect(listedNames()).toEqual(DEMO_STORES.map((store) => store.name));
    expect(markerCount()).toBe(5);
    expect(summaryValue('Jami do‘konlar')).toBe('5');
    expect(summaryValue('Xaritada ko‘rinmoqda')).toBe('5');
    expect(summaryValue('Tanlangan do‘kon')).toBe('Tanlanmagan');
    expect(summaryValue('Shahar')).toBe('Toshkent');

    const row = rowButton('Chilonzor');
    expect(within(row).getByText('Demo ma’lumot')).toBeInTheDocument();
    expect(within(row).getByText('41.27560, 69.20340')).toBeInTheDocument();
  });

  it('requests the store list exactly once', async () => {
    await renderLoaded();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('marks demo data in the header only when demo stores are present', async () => {
    await renderLoaded();
    expect(screen.getByText('Demo rejim')).toBeInTheDocument();
  });

  it('shows no demo badge for real data', async () => {
    await renderLoaded(
      storesPayload([{ ...CHILONZOR, name: 'Korzinka Chilonzor', source: 'admin' }]),
    );
    expect(screen.queryByText('Demo rejim')).not.toBeInTheDocument();
    // An unknown source is shown as stored.
    expect(within(rowButton('Korzinka')).getByText('admin')).toBeInTheDocument();
  });

  it('explains an empty database', async () => {
    await renderLoaded(storesPayload([]));

    expect(screen.getByText('Hozircha do‘konlar yo‘q')).toBeInTheDocument();
    expect(screen.getByText('Xaritada ko‘rsatish uchun do‘kon yo‘q.')).toBeInTheDocument();
    expect(summaryValue('Jami do‘konlar')).toBe('0');
    expect(markerCount()).toBe(0);
  });
});

describe('Dashboard search', () => {
  it('filters the list and the map without contacting the API', async () => {
    const user = await renderLoaded();

    await user.type(screen.getByRole('searchbox'), 'YUNUS');

    expect(listedNames()).toEqual([YUNUSOBOD.name]);
    expect(markerCount()).toBe(1);
    expect(screen.getByText('5 ta do‘kondan 1 tasi mos keldi')).toBeInTheDocument();
    expect(summaryValue('Jami do‘konlar')).toBe('5');
    expect(summaryValue('Xaritada ko‘rinmoqda')).toBe('1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('matches names typed with a keyboard apostrophe', async () => {
    const user = await renderLoaded();
    await user.type(screen.getByRole('searchbox'), "ulug'bek");
    expect(listedNames()).toEqual(['Demo do‘kon: Mirzo Ulug‘bek']);
  });

  it('shows an empty state with a way out when nothing matches', async () => {
    const user = await renderLoaded();

    await user.type(screen.getByRole('searchbox'), 'samarqand');

    expect(screen.getByText('“samarqand” bo‘yicha do‘kon topilmadi')).toBeInTheDocument();
    expect(screen.getByText('5 ta do‘kondan hech biri mos kelmadi')).toBeInTheDocument();
    expect(screen.getByText('Qidiruvga mos do‘kon topilmadi.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(markerCount()).toBe(0);

    // Two controls clear the search: the "x" in the field and the empty-state button.
    const clearButtons = screen.getAllByRole('button', { name: 'Qidiruvni tozalash' });
    expect(clearButtons).toHaveLength(2);
    await user.click(clearButtons[1]!);

    expect(screen.getByRole('searchbox')).toHaveValue('');
    // The pressed button is gone with the empty state; focus continues in the field.
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(listedNames()).toHaveLength(5);
    expect(markerCount()).toBe(5);
  });

  it('clears the search with the field button and with Escape', async () => {
    const user = await renderLoaded();
    const search = screen.getByRole('searchbox');

    await user.type(search, 'sergeli');
    await user.click(screen.getByRole('button', { name: 'Qidiruvni tozalash' }));
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(listedNames()).toHaveLength(5);

    await user.type(search, 'sergeli{Escape}');
    expect(search).toHaveValue('');
    expect(listedNames()).toHaveLength(5);
  });
});

describe('Dashboard selection', () => {
  it('selects a store from the list', async () => {
    const user = await renderLoaded();

    await user.click(rowButton('Yunusobod'));

    expect(rowButton('Yunusobod')).toHaveAttribute('aria-pressed', 'true');
    expect(rowButton('Chilonzor')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', YUNUSOBOD._id);
    expect(summaryValue('Tanlangan do‘kon')).toBe(YUNUSOBOD.name);

    // The details bar shows the coordinates and links out to OpenStreetMap.
    expect(screen.getByRole('heading', { level: 2, name: YUNUSOBOD.name })).toBeInTheDocument();
    expect(screen.getByText('41.36720')).toBeInTheDocument();
    expect(screen.getByText('69.28890')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OpenStreetMap’da ochish' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/?mlat=41.36720&mlon=69.28890#map=17/41.36720/69.28890',
    );
  });

  it('selects a store from a map marker', async () => {
    const user = await renderLoaded();

    await user.click(screen.getByRole('button', { name: `marker ${CHILONZOR.name}` }));

    expect(rowButton('Chilonzor')).toHaveAttribute('aria-pressed', 'true');
    expect(summaryValue('Tanlangan do‘kon')).toBe(CHILONZOR.name);
  });

  it('moves the selection when another store is chosen and clears it on request', async () => {
    const user = await renderLoaded();

    await user.click(rowButton('Chilonzor'));
    await user.click(rowButton('Sergeli'));
    expect(rowButton('Chilonzor')).toHaveAttribute('aria-pressed', 'false');
    expect(rowButton('Sergeli')).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Tanlovni bekor qilish' }));

    expect(rowButton('Sergeli')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '');
    expect(summaryValue('Tanlangan do‘kon')).toBe('Tanlanmagan');
    const hint = screen.getByText(/^Do‘kon tanlanmagan/);
    expect(hint).toBeInTheDocument();
    // Focus stays on the details bar rather than falling back to the page.
    expect(hint.parentElement).toHaveFocus();
  });

  it('forgets a selected store that a refresh removed, even if it later returns', async () => {
    const user = await renderLoaded();
    await user.click(rowButton('Yunusobod'));

    fetchMock.mockResolvedValueOnce(jsonResponse(storesPayload(DEMO_STORES.slice(0, 2))));
    await user.click(screen.getByRole('button', { name: 'Yangilash' }));
    await screen.findByText('Jami 2 ta do‘kon');
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '');

    fetchMock.mockResolvedValueOnce(jsonResponse(storesPayload()));
    await user.click(screen.getByRole('button', { name: 'Yangilash' }));
    await screen.findByText('Jami 5 ta do‘kon');

    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '');
    expect(rowButton('Yunusobod')).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the selection across a refresh that still contains the store', async () => {
    const user = await renderLoaded();
    await user.click(rowButton('Yunusobod'));

    fetchMock.mockResolvedValueOnce(jsonResponse(storesPayload()));
    await user.click(screen.getByRole('button', { name: 'Yangilash' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Yangilash' })).toBeEnabled());

    expect(rowButton('Yunusobod')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', YUNUSOBOD._id);
  });

  it('keeps the selection while the selected store still matches the search', async () => {
    const user = await renderLoaded();

    await user.click(rowButton('Yunusobod'));
    await user.type(screen.getByRole('searchbox'), 'yunus');

    expect(rowButton('Yunusobod')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', YUNUSOBOD._id);
  });

  it('drops the selection once the search excludes the store, and does not restore it', async () => {
    const user = await renderLoaded();
    const search = screen.getByRole('searchbox');

    await user.click(rowButton('Yunusobod'));
    await user.type(search, 'chilon');

    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '');
    expect(summaryValue('Tanlangan do‘kon')).toBe('Tanlanmagan');

    await user.clear(search);

    expect(listedNames()).toHaveLength(5);
    expect(rowButton('Yunusobod')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '');
  });

  it('copies the coordinates of the selected store', async () => {
    const user = await renderLoaded();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    await user.click(rowButton('Chilonzor'));
    await user.click(screen.getByRole('button', { name: 'Koordinatalarni nusxalash' }));

    expect(writeText).toHaveBeenCalledWith('41.27560, 69.20340');
    expect(await screen.findByRole('button', { name: 'Nusxalandi' })).toBeInTheDocument();
  });
});

describe('Dashboard error handling', () => {
  it('shows an error state when the server is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<Dashboard />);

    const alert = await screen.findByText('Do‘konlar ro‘yxatini yuklab bo‘lmadi');
    expect(alert.closest('[role="alert"]')).toHaveTextContent(
      'Serverga ulanib bo‘lmadi. Backend ishga tushganini va http://localhost:5000 manzili to‘g‘ri ekanini tekshiring.',
    );
    expect(screen.getByText('API bilan aloqa yo‘q')).toBeInTheDocument();
    expect(screen.getByText('Do‘konlarni yuklab bo‘lmadi.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(markerCount()).toBe(0);
    // The map itself is still rendered.
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('explains a database outage reported by the API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false }, 503));
    render(<Dashboard />);

    // The API did answer, so the header must not claim there is no connection.
    expect(await screen.findByText('API xatolik qaytardi')).toBeInTheDocument();
    expect(screen.queryByText('API bilan aloqa yo‘q')).not.toBeInTheDocument();

    expect(
      await screen.findByText(
        'Ma’lumotlar bazasi vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring.',
      ),
    ).toBeInTheDocument();
  });

  it('retries with a new request and recovers', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(jsonResponse(storesPayload()));
    const user = userEvent.setup();
    render(<Dashboard />);

    await screen.findByText('Do‘konlar ro‘yxatini yuklab bo‘lmadi');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole('button', { name: 'Qayta urinish' })[0]!);

    expect(await screen.findByText('Jami 5 ta do‘kon')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The retry button vanished with the error; focus stayed inside the list.
    expect(storeList().parentElement).toHaveFocus();
    expect(screen.queryByText('Do‘konlar ro‘yxatini yuklab bo‘lmadi')).not.toBeInTheDocument();
    expect(screen.getByText('API ulangan')).toBeInTheDocument();
    expect(markerCount()).toBe(5);
  });

  it('refreshes on demand with a new request', async () => {
    const user = await renderLoaded();
    fetchMock.mockResolvedValueOnce(jsonResponse(storesPayload(DEMO_STORES.slice(0, 2))));

    await user.click(screen.getByRole('button', { name: 'Yangilash' }));

    expect(await screen.findByText('Jami 2 ta do‘kon')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(markerCount()).toBe(2);
  });

  it('keeps the last good data on screen when a refresh fails', async () => {
    const user = await renderLoaded();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await user.click(screen.getByRole('button', { name: 'Yangilash' }));

    expect(await screen.findByText(/^Yangilab bo‘lmadi\. Ekranda soat/)).toBeInTheDocument();
    expect(screen.getByText('API bilan aloqa yo‘q')).toBeInTheDocument();
    expect(listedNames()).toHaveLength(5);
    expect(markerCount()).toBe(5);
  });

  it('skips invalid records instead of crashing and says how many were skipped', async () => {
    await renderLoaded(
      storesPayload([
        CHILONZOR,
        { ...YUNUSOBOD, lat: 541.3 },
        { ...YUNUSOBOD, _id: 'x', lng: 'east' },
        { _id: 'y', name: 'Broken' },
        null,
      ]),
    );

    expect(listedNames()).toEqual([CHILONZOR.name]);
    expect(markerCount()).toBe(1);
    expect(
      screen.getByText('4 ta yozuv noto‘g‘ri ma’lumot sababli ko‘rsatilmadi.'),
    ).toBeInTheDocument();
  });

  it('treats a malformed response as an error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stores: DEMO_STORES }));
    render(<Dashboard />);

    expect(
      await screen.findByText(
        'Serverdan kutilmagan formatdagi javob keldi. Backend versiyasini tekshiring.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(markerCount()).toBe(0));
  });
});

describe('Dashboard request lifecycle', () => {
  /** A fetch stub whose responses are released by the test, in any order. */
  function controllableFetch() {
    const pending: Array<(response: Response) => void> = [];
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          pending.push(resolve);
        }),
    );
    return pending;
  }

  it('ignores the response of a request that was superseded', async () => {
    const pending = controllableFetch();

    // StrictMode mounts effects twice in development: the first request is
    // aborted and a second one starts. This stub ignores the abort signal, so
    // the stale response does arrive and the hook itself has to drop it.
    render(
      <StrictMode>
        <Dashboard />
      </StrictMode>,
    );
    await waitFor(() => expect(pending).toHaveLength(2));

    await act(async () => {
      pending[0]!(jsonResponse(storesPayload(DEMO_STORES.slice(0, 2))));
    });
    expect(screen.queryByText('Jami 2 ta do‘kon')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Do‘konlar yuklanmoqda…' })).toBeInTheDocument();

    await act(async () => {
      pending[1]!(jsonResponse(storesPayload()));
    });
    expect(await screen.findByText('Jami 5 ta do‘kon')).toBeInTheDocument();
  });

  it('aborts the request in flight when the dashboard unmounts', async () => {
    controllableFetch();
    const { unmount } = render(<Dashboard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const signal = fetchMock.mock.calls[0]![1]!.signal!;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('does not start a second request while one is running', async () => {
    const pending = controllableFetch();
    const user = userEvent.setup();
    render(<Dashboard />);
    await waitFor(() => expect(pending).toHaveLength(1));

    // The refresh button is disabled during the initial load.
    const refresh = screen.getByRole('button', { name: 'Yangilanmoqda…' });
    expect(refresh).toBeDisabled();
    await user.click(refresh);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
