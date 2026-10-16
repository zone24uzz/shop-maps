import { CircleAlert, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/utils/cn';

export interface MapNoticeData {
  tone: 'info' | 'warning' | 'danger';
  message: string;
  /** Shows a spinner instead of the tone icon. */
  busy?: boolean;
  /**
   * Announce the message to screen readers. Off by default: most notices
   * repeat a state the store list already announces, and saying it twice is
   * noise. Turn it on when the notice is the only place the message appears.
   */
  announce?: boolean;
  action?: { label: string; onClick: () => void };
}

const TONE = {
  info: { icon: Info, box: 'border-line-strong bg-surface text-ink-soft' },
  warning: { icon: TriangleAlert, box: 'border-warning-line bg-warning-soft text-warning' },
  danger: { icon: CircleAlert, box: 'border-danger-line bg-danger-soft text-danger' },
} as const;

/** A short message laid over the map: loading, no results, failed request. */
export function MapNotice({
  tone,
  message,
  busy = false,
  announce = false,
  action,
}: MapNoticeData) {
  const boxRef = useRef<HTMLDivElement>(null);
  const { icon: ToneIcon, box } = TONE[tone];
  const Icon = busy ? LoaderCircle : ToneIcon;

  return (
    <div
      ref={boxRef}
      role={announce ? 'status' : undefined}
      tabIndex={-1}
      className={cn(
        'flex items-center gap-2.5 rounded border px-3 py-2 text-sm shadow-(--shadow-overlay)',
        box,
      )}
    >
      <Icon size={16} aria-hidden="true" className={cn('shrink-0', busy && 'animate-spin')} />
      <span className="min-w-0">{message}</span>
      {action ? (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            // The action usually replaces this notice with one that has no
            // button. Keep keyboard focus on the notice instead of losing it.
            boxRef.current?.focus();
          }}
          className="-my-1 -mr-1.5 ml-1 h-8 shrink-0 rounded px-2 font-medium underline underline-offset-2 hover:bg-white/60"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
