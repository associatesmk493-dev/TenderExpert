import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type Options = { title: string; description?: string; confirmLabel?: string; destructive?: boolean };

// A simple "why?" prompt. `const reason = await askReason({...})` resolves to the typed reason,
// or null if the user cancels. Render `reasonDialog` once in the component.
export function useReasonPrompt() {
  const [options, setOptions] = useState<Options | null>(null);
  const [text, setText] = useState('');
  const resolver = useRef<((value: string | null) => void) | null>(null);

  const askReason = useCallback((opts: Options) => new Promise<string | null>((resolve) => {
    resolver.current?.(null);
    resolver.current = resolve;
    setText('');
    setOptions(opts);
  }), []);

  const finish = (value: string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  const reasonDialog = (
    <Dialog open={options !== null} onOpenChange={(open) => { if (!open) finish(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{options?.title}</DialogTitle>
          {options?.description && <DialogDescription>{options.description}</DialogDescription>}
        </DialogHeader>
        <label className="block text-sm font-medium">
          Why?
          <Textarea autoFocus rows={3} className="mt-1" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a short reason…" />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => finish(null)}>Cancel</Button>
          <Button type="button" variant={options?.destructive === false ? 'default' : 'destructive'} disabled={text.trim().length < 3} onClick={() => finish(text.trim())}>
            {options?.confirmLabel || 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { askReason, reasonDialog };
}
