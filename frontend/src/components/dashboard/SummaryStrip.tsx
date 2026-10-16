import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { CURRENT_CITY } from '@/lib/constants';
import { messages } from '@/lib/messages';
import { cn } from '@/utils/cn';

export type LoadStatus = 'loading' | 'ready' | 'error';

interface SummaryStripProps {
  status: LoadStatus;
  totalCount: number;
  visibleCount: number;
  selectedName: string | null;
  className?: string;
}

interface CellProps {
  label: string;
  children: ReactNode;
}

function Cell({ label, children }: CellProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-surface px-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 font-display text-2xl leading-7 font-semibold text-ink tabular-nums">
        {children}
      </dd>
    </div>
  );
}

/**
 * The four figures the dashboard can actually back with data. One ruled strip
 * rather than four separate cards: they are read together, as a line.
 */
export function SummaryStrip({
  status,
  totalCount,
  visibleCount,
  selectedName,
  className,
}: SummaryStripProps) {
  const count = (value: number) => {
    if (status === 'loading') return <Skeleton className="my-1 h-5 w-10" />;
    if (status === 'error') {
      return (
        <span className="text-base font-medium text-muted">{messages.summary.unavailable}</span>
      );
    }
    return value;
  };

  return (
    <section aria-label={messages.summary.heading} className={className}>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,2fr)_minmax(0,1fr)]">
        <Cell label={messages.summary.totalStores}>{count(totalCount)}</Cell>
        <Cell label={messages.summary.visibleStores}>{count(visibleCount)}</Cell>
        <Cell label={messages.summary.selectedStore}>
          <span
            title={selectedName ?? undefined}
            className={cn('block truncate text-lg', !selectedName && 'font-medium text-muted')}
          >
            {selectedName ?? messages.summary.noSelection}
          </span>
        </Cell>
        <Cell label={messages.summary.city}>
          <span className="block truncate text-lg">{CURRENT_CITY}</span>
        </Cell>
      </dl>
    </section>
  );
}
