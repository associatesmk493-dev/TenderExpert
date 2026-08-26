import { useEffect, useState } from 'react';
import { addDays, differenceInDays, parseISO, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UpcomingOrderNotification {
  id: string;
  customer_name: string;
  phone: string | null;
  edd: string;
  daysUntil: number;
}

export function useUpcomingOrders() {
  const { user, isAdmin } = useAuth();
  const [orders, setOrders] = useState<UpcomingOrderNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchUpcoming = async () => {
      const today = startOfDay(new Date());
      const cutoff = addDays(today, 7);
      // Server-side date range — only fetch the small window (7 days), not all 676+ orders
      const todayStr  = today.toISOString().split('T')[0];
      const cutoffStr = cutoff.toISOString().split('T')[0];

      let query = supabase
        .from('leads')
        .select('id, customer_name, phone, edd')
        .in('funnel_stage', ['closure_order_1', 'delivered'])
        .gte('edd', todayStr)
        .lte('edd', cutoffStr)
        .order('edd', { ascending: true });

      if (!isAdmin) {
        query = query.eq('assigned_to', user.id);
      }

      const { data } = await query;
      if (data) {
        const upcoming = (data as any[]).map((o) => ({
          id: o.id,
          customer_name: o.customer_name,
          phone: o.phone,
          edd: o.edd,
          daysUntil: differenceInDays(parseISO(o.edd), today),
        })) as UpcomingOrderNotification[];
        setOrders(upcoming);
      }
      setLoading(false);
    };
    fetchUpcoming();
  }, [user, isAdmin]);

  return { orders, count: orders.length, loading };
}
