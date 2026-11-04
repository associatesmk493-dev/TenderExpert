/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { BadgeIndianRupee } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { leadState } from '@/lib/leadOptions';

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// Revenue booked from leads that finished (closed, not lost): their agreed amount. Forecast covers only open leads.
export default function BookedRevenue() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      let result: any = await supabase.from('b2g_leads' as any).select('expected_revenue,closed_at,lost_reason_code,stage,closure_outcome');
      if (result.error) result = await supabase.from('b2g_leads' as any).select('expected_revenue,closed_at,lost_reason_code,stage');
      setRows((result.data as any[]) || []);
    })();
  }, []);

  const closed = rows.filter((row) => leadState(row) === 'closed' && Number(row.expected_revenue) > 0);
  if (!closed.length) return null;
  const total = closed.reduce((sum, row) => sum + Number(row.expected_revenue), 0);
  return (
    <Card className="mb-4 border-0 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <BadgeIndianRupee className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="break-words text-xl font-extrabold">{money(total)}</p>
          <p className="text-xs text-muted-foreground">Booked revenue · {closed.length} closed lead{closed.length === 1 ? '' : 's'} with an agreed amount</p>
        </div>
      </CardContent>
    </Card>
  );
}
