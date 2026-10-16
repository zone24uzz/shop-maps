import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface StateMessageProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  tone?: 'neutral' | 'danger';
  /**
   * Live-region role: `alert` interrupts screen readers (errors), `status` is
   * announced politely. Leave it out when another element already announces
   * the same change.
   */
  role?: 'alert' | 'status';
  action?: ReactNode;
}

/** Empty and error states: says what happened and offers the next step. */
export function StateMessage({
  icon: Icon,
  title,
  body,
  tone = 'neutral',
  role,
  action,
}: StateMessageProps) {
  return (
    <div role={role} className="flex flex-col items-start gap-3 px-4 py-6">
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded',
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface-muted text-muted',
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="font-medium text-ink">{title}</p>
        {body ? <p className="text-sm leading-relaxed text-muted">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}
