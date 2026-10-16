import { Search, TriangleAlert, X } from 'lucide-react';
import { type RefObject, useId } from 'react';
import type { LoadStatus } from '@/components/dashboard/SummaryStrip';
import { Skeleton } from '@/components/ui/Skeleton';
import { matchCountLabel, messages, skippedRecordsLabel, storeCountLabel } from '@/lib/messages';
import { cn } from '@/utils/cn';

interface SearchPanelProps {
  /** Owned by the dashboard, which also moves focus here from the empty state. */
  inputRef: RefObject<HTMLInputElement | null>;
  status: LoadStatus;
  query: string;
  onQueryChange: (query: string) => void;
  totalCount: number;
  matchCount: number;
  skippedCount: number;
  className?: string;
}

export function SearchPanel({
  inputRef,
  status,
  query,
  onQueryChange,
  totalCount,
  matchCount,
  skippedCount,
  className,
}: SearchPanelProps) {
  const inputId = useId();
  const isFiltering = query.trim() !== '';

  const clear = () => {
    onQueryChange('');
    inputRef.current?.focus();
  };

  return (
    <div role="search" className={cn('space-y-2.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">{messages.list.heading}</h2>
        {/* Announced politely, so screen-reader users hear the result of typing. */}
        <p aria-live="polite" className="text-sm text-muted tabular-nums">
          {status === 'loading' ? <Skeleton className="h-4 w-28" /> : null}
          {status === 'ready'
            ? isFiltering
              ? matchCountLabel(matchCount, totalCount)
              : storeCountLabel(totalCount)
            : null}
        </p>
      </div>

      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          {messages.search.label}
        </label>
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query !== '') {
              event.preventDefault();
              clear();
            }
          }}
          placeholder={messages.search.placeholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-11 w-full rounded border border-control bg-surface pr-11 pl-9 text-base text-ink placeholder:text-muted hover:border-ink-soft focus-visible:border-primary focus-visible:outline-offset-0 lg:h-10 lg:text-sm"
        />
        {query !== '' ? (
          <button
            type="button"
            onClick={clear}
            aria-label={messages.search.clear}
            className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-muted transition-colors hover:bg-surface-muted hover:text-ink lg:h-8 lg:w-8"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {status === 'ready' && skippedCount > 0 ? (
        <p className="flex items-start gap-2 rounded border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning">
          <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {skippedRecordsLabel(skippedCount)}
        </p>
      ) : null}
    </div>
  );
}
