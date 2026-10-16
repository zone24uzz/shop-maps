import { MapPin } from 'lucide-react';
import { memo } from 'react';
import { messages, sourceLabel } from '@/lib/messages';
import type { Store } from '@/types/store';
import { cn } from '@/utils/cn';
import { formatCoordinates } from '@/utils/format';

interface StoreListItemProps {
  store: Store;
  isSelected: boolean;
  onSelect: (storeId: string) => void;
}

function StoreListItemComponent({ store, isSelected, onSelect }: StoreListItemProps) {
  return (
    <li data-store-id={store._id} className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => onSelect(store._id)}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-offset-[-2px]',
          isSelected
            ? 'bg-primary-soft shadow-[inset_3px_0_0_var(--color-primary)]'
            : 'hover:bg-surface-muted',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border',
            isSelected
              ? 'border-primary bg-primary text-white'
              : 'border-line-strong bg-surface text-primary',
          )}
        >
          <MapPin size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium break-words text-ink">{store.name}</span>
          <span className="mt-0.5 block text-sm text-muted">
            <span className="sr-only">{messages.store.source}: </span>
            {sourceLabel(store.source)}
          </span>
          <span className="block text-sm text-muted tabular-nums">
            <span className="sr-only">{messages.list.coordinates}: </span>
            {formatCoordinates(store.lat, store.lng)}
          </span>
        </span>
      </button>
    </li>
  );
}

// The list re-renders on every keystroke in the search box; rows whose props
// did not change are skipped.
export const StoreListItem = memo(StoreListItemComponent);
