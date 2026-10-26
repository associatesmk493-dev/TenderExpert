/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Handshake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const key = (name: string) => name.trim().toLowerCase();

// Every party (vendor / company) across all sites, with the projects it appears in — the other side of each site's Parties list.
export default function PartySheets({ rows, focus, stageLabel, onOpen }: { rows: any[]; focus: string; stageLabel: (value?: string | null) => string; onOpen: (row: any) => void }) {
  const [openKey, setOpenKey] = useState<string | null>(focus ? key(focus) : null);
  useEffect(() => {
    if (focus) setOpenKey(key(focus));
  }, [focus]);

  const parties = useMemo(() => {
    const groups = new Map<string, { name: string; projects: any[] }>();
    rows.forEach((row) => {
      (Array.isArray(row.parties) ? row.parties : []).forEach((raw: any) => {
        const name = String(raw || '').trim();
        if (!name) return;
        const entry = groups.get(key(name)) || { name, projects: [] };
        if (!entry.projects.includes(row)) entry.projects.push(row);
        groups.set(key(name), entry);
      });
    });
    return Array.from(groups.entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.projects.length - a.projects.length || a.name.localeCompare(b.name));
  }, [rows]);

  if (!parties.length) return <div className="rounded-2xl bg-white p-12 text-center text-sm text-muted-foreground">No parties added yet. Add them inside a tender under “Parties”.</div>;

  return (
    <div className="space-y-3">
      {parties.map(({ id, name, projects }) => {
        const expanded = openKey === id;
        return (
          <Card key={id} className="border-0 shadow-sm">
            <CardContent className="p-0">
              <button type="button" className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenKey(expanded ? null : id)}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Handshake className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold">{name}</h3>
                  <p className="text-xs text-muted-foreground">in {projects.length} project{projects.length === 1 ? '' : 's'}</p>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && (
                <div className="divide-y border-t">
                  {projects.map((project) => (
                    <button key={project.id} type="button" className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between" onClick={() => onOpen(project)}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{project.site_name || project.tender_title}</p>
                        <p className="truncate text-xs text-muted-foreground">{[project.tender_title !== project.site_name ? project.tender_title : '', project.authority_name, project.company_name].filter(Boolean).join(' · ')}</p>
                      </div>
                      {project.project_stage && <Badge variant="secondary" className="self-start">{stageLabel(project.project_stage)}</Badge>}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
