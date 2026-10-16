import { Check, Copy, ExternalLink, MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { messages, sourceLabel } from '@/lib/messages';
import type { Store } from '@/types/store';
import { formatCoordinate, formatCoordinates, openStreetMapUrl } from '@/utils/format';

interface SelectedStoreBarProps {
  store: Store | null;
  onClear: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

const COPY_FEEDBACK_MS = 2000;

function CopyCoordinatesButton({ lat, lng }: { lat: number; lng: number }) {
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timeoutId = setTimeout(() => setState('idle'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timeoutId);
  }, [state]);

  const copy = async () => {
    try {
      // Rejects without clipboard permission and is undefined on insecure origins.
      await navigator.clipboard.writeText(formatCoordinates(lat, lng));
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  const label =
    state === 'copied'
      ? messages.store.copied
      : state === 'failed'
        ? messages.store.copyFailed
        : messages.store.copyCoordinates;

  return (
    <Button onClick={copy}>
      {state === 'copied' ? (
        <Check size={16} aria-hidden="true" className="text-success" />
      ) : (
        <Copy size={16} aria-hidden="true" />
      )}
      <span aria-live="polite">{label}</span>
    </Button>
  );
}

/**
 * Details of the selected store, docked under the map so it never covers a
 * marker. Always rendered: the minimum heights below reserve the room the
 * details need (stacked on small screens, one row from `xl`), so selecting a
 * store does not resize the map or push the list down.
 */
export function SelectedStoreBar({ store, onClear }: SelectedStoreBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  const clear = () => {
    onClear();
    // The button that was just pressed disappears with the details.
    barRef.current?.focus();
  };

  return (
    <div
      ref={barRef}
      tabIndex={-1}
      className="flex min-h-32 rounded-md border border-line bg-surface px-4 py-3 xl:min-h-[4.75rem]"
    >
      {store ? (
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center xl:gap-x-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg leading-6 font-semibold break-words text-ink">
              {store.name}
            </h2>
            <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-muted">{messages.store.source}</dt>
                <dd>{sourceLabel(store.source)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">{messages.store.latitude}</dt>
                <dd className="tabular-nums">{formatCoordinate(store.lat)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">{messages.store.longitude}</dt>
                <dd className="tabular-nums">{formatCoordinate(store.lng)}</dd>
              </div>
            </dl>
          </div>

          <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-2 xl:col-span-1 xl:col-start-2 xl:row-start-1">
            {/* Keyed by store so "copied" feedback never carries over to another store. */}
            <CopyCoordinatesButton key={store._id} lat={store.lat} lng={store.lng} />
            <a
              href={openStreetMapUrl(store.lat, store.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded px-3 text-sm font-medium text-primary hover:bg-primary-soft hover:text-primary-hover"
            >
              <ExternalLink size={16} aria-hidden="true" />
              {messages.store.openInOsm}
            </a>
          </div>

          {/* Top-right corner when stacked, end of the row from `xl`. */}
          <button
            type="button"
            onClick={clear}
            aria-label={messages.store.clearSelection}
            title={messages.store.clearSelection}
            className="col-start-2 row-start-1 -mr-2 flex h-10 w-10 items-center justify-center rounded text-muted transition-colors hover:bg-surface-muted hover:text-ink xl:col-start-3"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="flex flex-1 items-center gap-3 text-sm text-muted">
          <MapPin size={18} aria-hidden="true" className="shrink-0 text-faint" />
          {messages.store.noSelectionHint}
        </p>
      )}
    </div>
  );
}
