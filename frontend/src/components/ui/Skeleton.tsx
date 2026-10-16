import { cn } from '@/utils/cn';

/** Placeholder block shown while content loads. Decorative: hidden from assistive tech. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('block animate-pulse rounded bg-line', className)} />
  );
}
