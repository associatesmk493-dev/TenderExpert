import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Users, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Campaign {
  name: string;
  count: number;
  latest: string | null;
}

const Campaigns = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchCampaigns = async () => {
      setLoading(true);
      let q = supabase
        .from('b2g_leads' as any)
        .select('campaign_name, created_at')
        .not('campaign_name', 'is', null)
        .neq('campaign_name', '');
      if (!isAdmin) q = q.eq('assigned_to', user.id);

      const { data, error } = await q;
      if (error) {
        toast({ title: 'Failed to load campaigns', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Group TenderExpert opportunities by campaign name.
      const map: Record<string, { count: number; latest: string | null }> = {};
      for (const row of data ?? []) {
        const key = (row as any).campaign_name as string;
        if (!map[key]) map[key] = { count: 0, latest: null };
        map[key].count += 1;
        if (!map[key].latest || (row.created_at && row.created_at > map[key].latest!)) {
          map[key].latest = row.created_at;
        }
      }

      const list: Campaign[] = Object.entries(map)
        .map(([name, { count, latest }]) => ({ name, count, latest }))
        .sort((a, b) => b.count - a.count);

      setCampaigns(list);
      setLoading(false);
    };
    fetchCampaigns();
  }, [user, isAdmin]); // eslint-disable-line

  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalLeads = campaigns.reduce((sum, c) => sum + c.count, 0);

  // Consistent color per campaign name
  const colorPalette = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  ];
  const getColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colorPalette[Math.abs(hash) % colorPalette.length];
  };

  return (
    <div className="max-w-lg mx-auto lg:max-w-4xl">
      {/* Header */}
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Campaigns</h1>
            <p className="text-[14px] text-muted-foreground">
              {campaigns.length} campaigns · {totalLeads.toLocaleString('en-IN')} total leads
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaign..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card border-border/60 shadow-sm text-[15px]"
          />
        </div>
      </div>

      {/* Campaign Cards */}
      <div className="px-4 space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 animate-in">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-2 text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-[15px] font-medium text-muted-foreground">No campaigns found</p>
            <p className="text-[13px] text-muted-foreground/70 mt-1">
              Import leads with a Sub-Category / Campaign Name to see them here
            </p>
          </div>
        ) : (
          filtered.map((campaign) => {
            const color = getColor(campaign.name);
            const initials = campaign.name.slice(0, 2).toUpperCase();
            return (
              <button
                key={campaign.name}
                onClick={() => navigate(`/leads?campaign=${encodeURIComponent(campaign.name)}`)}
                className="w-full text-left rounded-2xl p-4 card-interactive border border-border/20 bg-card/60 glass-subtle flex items-center gap-3"
              >
                {/* Icon */}
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-[15px] font-bold shrink-0 text-white"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] text-foreground truncate">{campaign.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[13px] text-muted-foreground">
                      {campaign.count.toLocaleString('en-IN')} lead{campaign.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Right */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: color + '18', color }}
                  >
                    {campaign.count}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-[13px] text-muted-foreground text-center py-4">
          {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default Campaigns;
