import Link from 'next/link';
import { messages } from '@/lib/messages';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-md border border-line bg-surface p-6">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold text-ink">
            {messages.page.notFoundTitle}
          </h1>
          <p className="text-sm leading-relaxed text-muted">{messages.page.notFoundBody}</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded bg-primary px-3.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {messages.page.goHome}
        </Link>
      </div>
    </main>
  );
}
