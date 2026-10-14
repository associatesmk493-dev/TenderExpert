/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type CalcLine = { label: string; kind: 'in' | 'out'; amount: string; note: string };
export type CalcOption = { name: string; lines: CalcLine[] };

const PRESET: CalcLine[] = [
  { label: 'Project Value', kind: 'in', amount: '', note: '' },
  { label: 'Product Cost', kind: 'out', amount: '', note: '' },
  { label: 'Commission', kind: 'out', amount: '', note: '' },
  { label: 'Taxes + Transportation', kind: 'out', amount: '', note: '' },
  { label: 'Consultancy', kind: 'out', amount: '', note: '' },
  { label: 'Work Order (Consultancy)', kind: 'out', amount: '', note: '' },
];

export const newOption = (index: number): CalcOption => ({ name: `Option ${index}`, lines: PRESET.map((line) => ({ ...line })) });

export const toCalcOptions = (value: any): CalcOption[] =>
  Array.isArray(value) && value.length
    ? value.map((option: any, index: number) => ({
        name: option.name || `Option ${index + 1}`,
        lines: (option.lines || []).map((line: any) => ({
          label: line.label || '',
          kind: line.kind === 'in' ? 'in' : 'out',
          amount: line.amount ? String(line.amount) : '',
          note: line.note || '',
        })),
      }))
    : [];

export const cleanCalcOptions = (options: CalcOption[]) =>
  options.map((option) => ({
    name: option.name.trim() || 'Option',
    lines: option.lines
      .filter((line) => line.label.trim() || Number(line.amount))
      .map((line) => ({ label: line.label.trim(), kind: line.kind, amount: Number(line.amount) || 0, note: line.note.trim() })),
  }));

// Net profit of one option: money in minus money out.
export const netOf = (lines: { kind: string; amount: string | number }[]) =>
  lines.reduce((sum, line) => sum + (line.kind === 'in' ? 1 : -1) * (Number(line.amount) || 0), 0);

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function CalcOptions({ options, onChange }: { options: CalcOption[]; onChange: (options: CalcOption[]) => void }) {
  const setOption = (index: number, patch: Partial<CalcOption>) => onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  const setLine = (optionIndex: number, lineIndex: number, patch: Partial<CalcLine>) =>
    setOption(optionIndex, { lines: options[optionIndex].lines.map((line, i) => (i === lineIndex ? { ...line, ...patch } : line)) });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Project calculations</h3>
          <p className="text-xs text-muted-foreground">Compare options — project value, costs, commission and the net profit</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...options, newOption(options.length + 1)])}>
          <Plus className="mr-1 h-4 w-4" />
          Add option
        </Button>
      </div>
      {!options.length && <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-muted-foreground">No calculation yet. Click “Add option” to start with Option 1.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {options.map((option, optionIndex) => {
          const net = netOf(option.lines);
          return (
            <div key={optionIndex} className="rounded-xl border bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <Input className="h-9 font-semibold" value={option.name} onChange={(e) => setOption(optionIndex, { name: e.target.value })} />
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${option.name}`} onClick={() => onChange(options.filter((_, i) => i !== optionIndex))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {option.lines.map((line, lineIndex) => (
                  <div key={lineIndex} className="grid grid-cols-[1fr_84px_110px_auto] gap-1.5">
                    <Input value={line.label} placeholder="Item" onChange={(e) => setLine(optionIndex, lineIndex, { label: e.target.value })} />
                    <select
                      aria-label="Money in or out"
                      className="h-10 rounded-md border bg-background px-2 text-xs"
                      value={line.kind}
                      onChange={(e) => setLine(optionIndex, lineIndex, { kind: e.target.value as 'in' | 'out' })}
                    >
                      <option value="in">Income +</option>
                      <option value="out">Cost −</option>
                    </select>
                    <Input type="number" min="0" value={line.amount} placeholder="Amount" onChange={(e) => setLine(optionIndex, lineIndex, { amount: e.target.value })} />
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove line" onClick={() => setOption(optionIndex, { lines: option.lines.filter((_, i) => i !== lineIndex) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Input className="col-span-4 h-8 text-xs" value={line.note} placeholder="Note (e.g. 23 %, on award)" onChange={(e) => setLine(optionIndex, lineIndex, { note: e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Button type="button" size="sm" variant="ghost" onClick={() => setOption(optionIndex, { lines: [...option.lines, { label: '', kind: 'out', amount: '', note: '' }] })}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add line
                </Button>
                <p className="text-sm">
                  <span className="text-muted-foreground">Net profit: </span>
                  <span className={`font-bold ${net < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{money(net)}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
