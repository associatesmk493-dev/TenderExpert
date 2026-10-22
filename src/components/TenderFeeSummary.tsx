/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { feeTotals } from '@/components/SuccessFees';

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// MKA success-fee position across all tenders. Pass `rows` when the tenders are already loaded.
export default function TenderFeeSummary({ rows }: { rows?: any[] }) {
  const [fetched, setFetched] = useState<any[]>([]);
  useEffect(() => {
    if (rows) return;
    supabase
      .from('tender_opportunities' as any)
      .select('success_fees')
      .then(({ data }) => setFetched((data as any[]) || []));
  }, [rows]);

  const totals = feeTotals((rows || fetched).flatMap((row) => (Array.isArray(row.success_fees) ? row.success_fees : [])));
  if (!totals.potential) return null;

  const tiles = [
    { label: 'Fees proposed (all)', value: totals.potential, tone: '' },
    { label: 'Fees agreed', value: totals.agreed, tone: '' },
    { label: 'Fees received', value: totals.received, tone: 'text-emerald-700' },
    { label: 'Fees to collect', value: totals.outstanding, tone: 'text-amber-700' },
    { label: 'Overdue fees', value: totals.overdue, tone: totals.overdue > 0 ? 'text-rose-700' : '' },
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <Card key={tile.label} className="min-w-0 border-0 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className={`break-words text-base font-extrabold sm:text-xl ${tile.tone}`}>{money(tile.value)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tile.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
