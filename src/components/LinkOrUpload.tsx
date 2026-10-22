import { useRef, useState } from 'react';
import { ExternalLink, Paperclip, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PREFIX = 'storage:';

// A document that is either a pasted link (Drive etc.) or a file uploaded to the app's private document store.
export default function LinkOrUpload({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const stored = value.startsWith(PREFIX);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const path = `tenders/${user?.id || 'shared'}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const { error } = await supabase.storage.from('b2g-documents').upload(path, file);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = '';
    if (error) {
      toast({ title: 'File not uploaded', description: `${error.message} (PDF, Word, Excel or image up to 25 MB)`, variant: 'destructive' });
      return;
    }
    onChange(`${PREFIX}${path}`);
  };

  const open = async () => {
    if (!stored) {
      window.open(value.trim(), '_blank', 'noopener');
      return;
    }
    const tab = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('b2g-documents').createSignedUrl(value.slice(PREFIX.length), 300);
    if (error || !data?.signedUrl) {
      tab?.close();
      toast({ title: 'Could not open the file', description: error?.message, variant: 'destructive' });
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
  };

  return (
    <div className="flex gap-2">
      <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
      {stored ? (
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border bg-slate-50 px-3 text-sm">
          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{value.split('/').pop()?.replace(/^\d+-/, '')}</span>
          <button type="button" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground" aria-label="Remove file" onClick={() => onChange('')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Input type="url" className="min-w-0 flex-1" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {!stored && (
        <Button type="button" variant="outline" className="shrink-0" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Paperclip className="mr-1 h-4 w-4" />
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
      )}
      {value.trim() && (
        <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Open document" onClick={open}>
          <ExternalLink className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
