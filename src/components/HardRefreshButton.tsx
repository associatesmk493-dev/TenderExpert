import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Hard refresh: drops the PWA service worker and its cached files, then reloads, so the newest version of the
// app and fresh data load. Login is kept (it is not stored in these caches).
export async function hardRefresh() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* reload anyway */
  }
  window.location.reload();
}

export default function HardRefreshButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-9 w-9', className)}
      title="Hard refresh (load the latest version)"
      aria-label="Hard refresh"
      disabled={busy}
      onClick={() => { setBusy(true); hardRefresh(); }}
    >
      <RefreshCw className={cn('h-5 w-5 text-foreground/80', busy && 'animate-spin')} />
    </Button>
  );
}
