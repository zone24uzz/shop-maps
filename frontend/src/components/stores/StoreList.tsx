import { CircleAlert, SearchX, Store as StoreIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { LoadStatus } from '@/components/dashboard/SummaryStrip';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StateMessage } from '@/components/ui/StateMessage';
import { messages, noMatchTitle } from '@/lib/messages';
import type { Store } from '@/types/store';
import { cn } from '@/utils/cn';
import { StoreListItem } from './StoreListItem';

interface StoreListProps {
  status: LoadStatus;
  stores: readonly Store[];
  totalCount: number;
  query: string;
  selectedId: string | null;
  errorMessage: string | null;
  onSelect: (storeId: string) => void;
  onClearSearch: () => void;
  onRetry: () => void;
  className?: string;
}

const SKELETON_ROWS = 5;

function ListSkeleton() {
  return (
    <div role="status" aria-label={messages.list.loading}>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
          <Skeleton className="h-8 w-8 shrink-0" />
          <div className="flex-1 space-y-2 py-0.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StoreList({
  status,
  stores,
  totalCount,
  query,
  selectedId,
  errorMessage,
  onSelect,
  onClearSearch,
  onRetry,
  className,
}: StoreListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the selected row in view when the selection comes from the map.
  // Skipped when the list does not scroll on its own (mobile layout), where
  // it would scroll the whole page away from the map.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !selectedId) return;
    if (container.scrollHeight <= container.clientHeight) return;

    const row = Array.from(container.querySelectorAll<HTMLElement>('[data-store-id]')).find(
      (element) => element.dataset.storeId === selectedId,
    );
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const retry = () => {
    onRetry();
    // The error state, button included, gives way to the loading skeleton.
    // Keep keyboard focus in the list instead of dropping it to the page.
    containerRef.current?.focus();
  };

  let content;
  if (status === 'loading') {
    content = <ListSkeleton />;
  } else if (status === 'error') {
    content = (
      <StateMessage
        role="alert"
        tone="danger"
        icon={CircleAlert}
        title={messages.list.errorTitle}
        body={errorMessage ?? undefined}
        action={
          <Button variant="primary" onClick={retry}>
            {messages.list.retry}
          </Button>
        }
      />
    );
  } else if (totalCount === 0) {
    content = (
      <StateMessage
        role="status"
        icon={StoreIcon}
        title={messages.list.emptyTitle}
        body={messages.list.emptyBody}
      />
    );
  } else if (stores.length === 0) {
    // No live-region role: the match count in the search panel already
    // announces that nothing matched.
    content = (
      <StateMessage
        icon={SearchX}
        title={noMatchTitle(query)}
        body={messages.list.noMatchBody}
        action={<Button onClick={onClearSearch}>{messages.search.clear}</Button>}
      />
    );
  } else {
    content = (
      <ul>
        {stores.map((store) => (
          <StoreListItem
            key={store._id}
            store={store}
            isSelected={store._id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    );
  }

  return (
    <div ref={containerRef} tabIndex={-1} className={cn('bg-surface', className)}>
      {content}
    </div>
  );
}
