import { RefreshCw } from 'lucide-react';
import { messages } from '@/lib/messages';
import { cn } from '@/utils/cn';
import { formatClockTime } from '@/utils/format';

/**
 * `offline`: the API could not be reached. `error`: it answered, but with an
 * error or an unusable response.
 */
export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'error';

interface AppHeaderProps {
  connection: ConnectionStatus;
  isDemo: boolean;
  lastUpdated: Date | null;
  isFetching: boolean;
  onRefresh: () => void;
}

const CONNECTION: Record<ConnectionStatus, { label: string; dot: string }> = {
  connecting: { label: messages.header.statusConnecting, dot: 'bg-on-dark-muted animate-pulse' },
  online: { label: messages.header.statusOnline, dot: 'bg-success-bright' },
  offline: { label: messages.header.statusOffline, dot: 'bg-danger-bright' },
  error: { label: messages.header.statusError, dot: 'bg-warning-bright' },
};

function LogoMark() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
      <rect width="28" height="28" rx="6" className="fill-primary" />
      {/* A route from an origin point to a destination. */}
      <path
        d="M9.5 20.5h5.25a3.25 3.25 0 0 0 0-6.5h-1.5a3.25 3.25 0 0 1 0-6.5H16"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="7.5" cy="20.5" r="2.5" fill="#fff" />
      <circle cx="19.5" cy="7.5" r="2.5" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

export function AppHeader({
  connection,
  isDemo,
  lastUpdated,
  isFetching,
  onRefresh,
}: AppHeaderProps) {
  const status = CONNECTION[connection];

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 bg-ink px-4 text-white">
      <div className="flex min-w-0 items-center gap-2.5">
        <LogoMark />
        <h1 className="truncate font-display text-xl font-semibold tracking-wide">
          {messages.appName}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <p role="status" className="flex items-center gap-2 text-sm text-on-dark-muted">
          <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', status.dot)} />
          <span className="sr-only sm:not-sr-only">{status.label}</span>
        </p>

        {lastUpdated ? (
          <p className="hidden text-sm text-on-dark-muted tabular-nums md:block">
            {messages.header.lastUpdated}{' '}
            <time dateTime={lastUpdated.toISOString()}>{formatClockTime(lastUpdated)}</time>
          </p>
        ) : null}

        {isDemo ? (
          <span
            title={messages.header.demoBadgeHint}
            className="rounded border border-warning-bright/50 bg-warning-bright/10 px-2 py-0.5 text-sm font-medium text-warning-bright"
          >
            {messages.header.demoBadge}
          </span>
        ) : null}

        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={isFetching ? messages.header.refreshing : messages.header.refresh}
          className="inline-flex h-10 items-center justify-center gap-2 rounded border border-white/20 bg-white/10 px-2.5 text-sm font-medium transition-colors hover:bg-white/20 focus-visible:outline-white disabled:cursor-progress disabled:opacity-70 sm:px-3"
        >
          <RefreshCw size={16} aria-hidden="true" className={cn(isFetching && 'animate-spin')} />
          <span className="hidden sm:inline">{messages.header.refresh}</span>
        </button>
      </div>
    </header>
  );
}
