/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseCurrentSites, siteKey, type ParsedSite } from '@/lib/tenderExcel';
import { skippedMessage, writeManyWithFallback, writeWithFallback } from '@/lib/writeWithFallback';

type Preview = { site: ParsedSite; existingId: string | null };

const payloadOf = (site: ParsedSite) => ({
  authority_name: site.site_name,
  tender_title: site.tender_title || site.site_name,
  month: site.month || null,
  site_name: site.site_name,
  division: site.division || null,
  offices: site.offices,
  status_log: site.status_log,
  parties: site.parties,
  documents: site.documents,
  approved_fund: site.approved_fund || null,
  estimated_value: site.estimated_value,
  conversation: site.conversation || null,
  boq_items: site.boq_items,
  calculations: site.calculations,
});

// One-time load of the client's existing Current Sites Excel sheet into Tender opportunities.
export default function TenderExcelTools({ rows, onImported }: { rows: any[]; onImported: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const [importing, setImporting] = useState(false);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const sites = await parseCurrentSites(await file.arrayBuffer());
      if (!sites.length) throw new Error('No sites were found in this sheet.');
      const existing = new Map(rows.map((row) => [siteKey({ month: row.month, site_name: row.site_name || row.tender_title, tender_title: row.tender_title }), row.id]));
      setPreview(
        sites.map((site) => ({
          site,
          existingId: existing.get(siteKey({ month: site.month, site_name: site.site_name, tender_title: site.tender_title || site.site_name })) || null,
        })),
      );
    } catch (error: any) {
      toast({ title: 'Excel could not be read', description: error?.message, variant: 'destructive' });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setImporting(true);
    const fresh = preview.filter((item) => !item.existingId);
    const updates = preview.filter((item) => item.existingId);
    let failed = '';
    const skippedColumns = new Set<string>();

    for (let start = 0; start < fresh.length; start += 25) {
      const batch = fresh.slice(start, start + 25).map((item) => ({ ...payloadOf(item.site), owner_id: user?.id }));
      const { result, skipped } = await writeManyWithFallback((body) => supabase.from('tender_opportunities' as any).insert(body), batch);
      skipped.forEach((column) => skippedColumns.add(column));
      if (result.error) failed = result.error.message;
    }
    for (const item of updates) {
      const { result, skipped } = await writeWithFallback((body) => supabase.from('tender_opportunities' as any).update(body).eq('id', item.existingId), payloadOf(item.site));
      skipped.forEach((column) => skippedColumns.add(column));
      if (result.error) failed = result.error.message;
    }
    setImporting(false);
    if (failed) {
      toast({ title: 'Import stopped', description: failed, variant: 'destructive' });
      return;
    }
    toast({ title: `Imported ${fresh.length} new, updated ${updates.length}`, description: skippedMessage(Array.from(skippedColumns)) });
    setPreview(null);
    onImported();
  };

  const newCount = preview?.filter((item) => !item.existingId).length || 0;

  return (
    <>
      <input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
      <Button variant="outline" onClick={() => fileInput.current?.click()}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Import Excel
      </Button>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && !importing && setPreview(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import from Excel</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {preview?.length} site{preview?.length === 1 ? '' : 's'} found — {newCount} new, {(preview?.length || 0) - newCount} already in the app (they will be updated from the sheet).
            </p>
          </DialogHeader>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Scope of work</th>
                  <th className="px-3 py-2">Parties</th>
                  <th className="px-3 py-2">BOQ rows</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {preview?.map(({ site, existingId }, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-3 py-2">{site.month || '—'}</td>
                    <td className="px-3 py-2 font-medium">{site.site_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{site.tender_title || '—'}</td>
                    <td className="px-3 py-2">{site.parties.length}</td>
                    <td className="px-3 py-2">{site.boq_items.length}</td>
                    <td className="px-3 py-2">{existingId ? <Badge variant="secondary">Update</Badge> : <Badge>New</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={importing} onClick={() => setPreview(null)}>Cancel</Button>
            <Button disabled={importing} onClick={runImport}>{importing ? 'Importing…' : `Import ${preview?.length || 0} sites`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
