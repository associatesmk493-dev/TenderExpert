/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { feeTotals } from '@/components/SuccessFees';

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

// One sheet per company: every project we handle for it, and its success-fee position.
export default function CompanySheets({ rows, stageLabel, onOpen }: { rows: any[]; stageLabel: (value?: string | null) => string; onOpen: (row: any) => void }) {
  const [openName, setOpenName] = useState<string | null>(null);
  const companies = useMemo(() => {
    const groups = new Map<string, any[]>();
    rows.forEach((row) => {
      const name = String(row.company_name || '').trim() || 'No company set';
      groups.set(name, [...(groups.get(name) || []), row]);
    });
    return Array.from(groups.entries())
      .map(([name, projects]) => ({ name, projects, totals: feeTotals(projects.flatMap((project) => (Array.isArray(project.success_fees) ? project.success_fees : []))) }))
      .sort((a, b) => b.projects.length - a.projects.length);
  }, [rows]);

  if (!companies.length) return <div className="rounded-2xl bg-white p-12 text-center text-sm text-muted-foreground">No tenders yet.</div>;

  return (
    <div className="space-y-3">
      {companies.map(({ name, projects, totals }) => {
        const expanded = openName === name;
        return (
          <Card key={name} className="border-0 shadow-sm">
            <CardContent className="p-0">
              <button type="button" className="flex w-full flex-col gap-3 p-5 text-left lg:flex-row lg:items-center" onClick={() => setOpenName(expanded ? null : name)}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Building2 className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold">{name}</h3>
                    <p className="text-xs text-muted-foreground">{projects.length} project{projects.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                  <p><span className="block text-muted-foreground">Agreed fee</span><span className="text-sm font-bold">{money(totals.agreed)}</span></p>
                  <p><span className="block text-muted-foreground">Received</span><span className="text-sm font-bold text-emerald-700">{money(totals.received)}</span></p>
                  <p><span className="block text-muted-foreground">To collect</span><span className="text-sm font-bold text-amber-700">{money(totals.outstanding)}</span></p>
                  <p><span className="block text-muted-foreground">Overdue</span><span className={`text-sm font-bold ${totals.overdue > 0 ? 'text-rose-700' : ''}`}>{money(totals.overdue)}</span></p>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && (
                <div className="divide-y border-t">
                  {projects.map((project) => {
                    const fee = feeTotals(Array.isArray(project.success_fees) ? project.success_fees : []);
                    return (
                      <button key={project.id} type="button" className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between" onClick={() => onOpen(project)}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{project.site_name || project.tender_title}</p>
                          <p className="truncate text-xs text-muted-foreground">{[project.tender_title !== project.site_name ? project.tender_title : '', project.authority_name].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {project.project_stage && <Badge variant="secondary">{stageLabel(project.project_stage)}</Badge>}
                          {fee.potential > 0 && <span className="text-muted-foreground">Fee {money(fee.potential)} · received {money(fee.received)}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
