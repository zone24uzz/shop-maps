'use client';

import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { messages } from '@/lib/messages';

interface ErrorPageProps {
  error: Error & { digest?: string };
  /** Re-fetches and re-renders the failed segment (Next.js 16.3+). */
  retry: () => void;
}

/** Route-level error boundary: a rendering failure never leaves a blank page. */
export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div
        role="alert"
        className="w-full max-w-md space-y-4 rounded-md border border-line bg-surface p-6"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded bg-danger-soft text-danger">
          <CircleAlert size={18} aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-ink">
            {messages.page.errorTitle}
          </h1>
          <p className="text-sm leading-relaxed text-muted">{messages.page.errorBody}</p>
        </div>
        <Button variant="primary" onClick={() => retry()}>
          {messages.page.retry}
        </Button>
      </div>
    </main>
  );
}
