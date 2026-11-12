/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import DeptNotes, { toDeptNotes, type DeptNote } from '@/components/DeptNotes';

export type Department = { id: string; name: string; state: string; status: string; notes: DeptNote[]; updated_at: string };

export const DEPT_STATUSES = ['Not started', 'Requested', 'Documents submitted', 'Feedback received', 'Changes made', 'Resubmitted', 'Approved', 'Rejected', 'On hold'];
const STATUS_STYLE: Record<string, string> = {
  Approved: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-rose-100 text-rose-800',
  'On hold': 'bg-slate-200 text-slate-700',
  'Not started': 'bg-slate-100 text-slate-600',
};

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const toDepartments = (value: any): Department[] =>
  Array.isArray(value)
    ? value.map((d: any) => ({
        id: String(d.id || newId()), name: d.name || '', state: d.state || '', status: DEPT_STATUSES.includes(d.status) ? d.status : 'Not started',
        notes: toDeptNotes(d.notes), updated_at: d.updated_at || '',
      }))
    : [];

// One lead, many departments/states: each has its own status and follow-up note log, so a client with
// 7-8 parallel departments does not need 7-8 separate leads.
export default function LeadDepartments({ departments, onSave, author }: { departments: any; onSave: (departments: Department[]) => void; author: string }) {
  const list = useMemo(() => toDepartments(departments), [departments]);
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const now = () => new Date().toISOString();

  const add = () => {
    if (!name.trim()) return;
    onSave([...list, { id: newId(), name: name.trim(), state: state.trim(), status: 'Not started', notes: [], updated_at: now() }]);
    setName(''); setState('');
  };
  // One per line: "Department, State" (state optional). Lets you add all 7-8 at once.
  const addBulk = () => {
    const rows = bulk.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [n, ...rest] = l.split(',');
      return { id: newId(), name: n.trim(), state: rest.join(',').trim(), status: 'Not started', notes: [] as DeptNote[], updated_at: now() };
    }).filter((r) => r.name);
    if (!rows.length) return;
    onSave([...list, ...rows]);
    setBulk(''); setShowBulk(false);
  };
  const patch = (id: string, p: Partial<Department>) => onSave(list.map((d) => (d.id === id ? { ...d, ...p, updated_at: now() } : d)));
  const remove = (d: Department) => {
    if (window.confirm(`Remove "${d.name}${d.state ? ` – ${d.state}` : ''}" and its notes from this lead?`)) onSave(list.filter((x) => x.id !== d.id));
  };

  const approved = list.filter((d) => d.status === 'Approved').length;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-bold">Departments / states</h2>
            <p className="text-xs text-muted-foreground">Track every department or state under this one lead, each with its own status and notes</p>
          </div>
          {list.length > 0 && <Badge variant="secondary">{approved} of {list.length} approved</Badge>}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="Department (e.g. CPWD)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Input placeholder="State / region (e.g. Haryana)" value={state} onChange={(e) => setState(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Button type="button" disabled={!name.trim()} onClick={add}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </div>
        <button type="button" className="mt-2 text-xs font-medium text-primary underline" onClick={() => setShowBulk((v) => !v)}>
          {showBulk ? 'Hide bulk add' : 'Add many at once'}
        </button>
        {showBulk && (
          <div className="mt-2 rounded-xl bg-slate-50 p-3">
            <Textarea rows={5} className="bg-white" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'One per line: Department, State\nCPWD, Haryana\nCPWD, Assam\nCPWD, Punjab'} />
            <Button type="button" size="sm" className="mt-2" disabled={!bulk.trim()} onClick={addBulk}>Add all</Button>
          </div>
        )}

        {list.length > 0 && (
          <ul className="mt-4 space-y-2">
            {list.map((d) => {
              const expanded = open === d.id;
              return (
                <li key={d.id} className="rounded-xl border bg-white">
                  <div className="flex flex-wrap items-center gap-2 p-3">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(expanded ? null : d.id)} aria-expanded={expanded}>
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{d.name}{d.state ? ` – ${d.state}` : ''}</span>
                        <span className="block text-xs text-muted-foreground">
                          {d.notes.length} note{d.notes.length === 1 ? '' : 's'}{d.updated_at ? ` · updated ${new Date(d.updated_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''}
                        </span>
                      </span>
                    </button>
                    <Select value={d.status} onValueChange={(status) => patch(d.id, { status })}>
                      <SelectTrigger className={`h-8 w-[180px] text-xs ${STATUS_STYLE[d.status] || 'bg-sky-50 text-sky-800'}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{DEPT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-rose-600" aria-label={`Remove ${d.name}`} onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {expanded && (
                    <div className="border-t p-3">
                      <DeptNotes notes={d.notes} author={author} onChange={(notes) => patch(d.id, { notes })} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
