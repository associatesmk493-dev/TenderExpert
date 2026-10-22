/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type FeeRow = { label: string; amount: string; status: string; trigger: string; due: string; received: string };

// proposed → agreed → earned (trigger achieved) → invoiced → part paid → paid
export const FEE_STATUS: { value: string; label: string }[] = [
  { value: 'proposed', label: 'Proposed' },
  { value: 'agreed', label: 'Agreed' },
  { value: 'earned', label: 'Earned (order / trigger done)' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'part_paid', label: 'Part paid' },
  { value: 'paid', label: 'Paid' },
];

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export const blankFee = (): FeeRow => ({ label: '', amount: '', status: 'proposed', trigger: '', due: '', received: '' });

export const toFees = (value: any): FeeRow[] =>
  Array.isArray(value)
    ? value.map((fee: any) => ({
        label: fee.label || '',
        amount: fee.amount ? String(fee.amount) : '',
        status: fee.status || 'proposed',
        trigger: fee.trigger || '',
        due: fee.due || '',
        received: fee.received ? String(fee.received) : '',
      }))
    : [];

export const cleanFees = (fees: FeeRow[]) =>
  fees
    .filter((fee) => fee.label.trim() || Number(fee.amount))
    .map((fee) => ({
      label: fee.label.trim(),
      amount: Number(fee.amount) || 0,
      status: fee.status,
      trigger: fee.trigger.trim(),
      due: fee.due || '',
      received: fee.status === 'paid' && !Number(fee.received) ? Number(fee.amount) || 0 : Number(fee.received) || 0,
    }));

// Totals for a list of fee milestones (works on stored rows and on form rows).
export const feeTotals = (fees: any[]) => {
  const today = new Date().toISOString().slice(0, 10);
  let potential = 0;
  let agreed = 0;
  let received = 0;
  let outstanding = 0;
  let overdue = 0;
  for (const fee of fees || []) {
    const amount = Number(fee.amount) || 0;
    const got = fee.status === 'paid' && !Number(fee.received) ? amount : Number(fee.received) || 0;
    potential += amount;
    if (fee.status !== 'proposed') agreed += amount;
    received += got;
    if (['earned', 'invoiced', 'part_paid'].includes(fee.status)) {
      const left = Math.max(amount - got, 0);
      outstanding += left;
      if (fee.due && fee.due < today) overdue += left;
    }
  }
  return { potential, agreed, received, outstanding, overdue };
};

const statusName = (value: string) => FEE_STATUS.find((status) => status.value === value)?.label.replace(/ \(.*\)/, '') || value;

// Plain-language list of what changed between the saved fee lines and the new ones (for the change history).
export const describeFeeChanges = (before: any[], after: any[]) => {
  const changes: string[] = [];
  after.forEach((fee, index) => {
    const old = before[index];
    const name = fee.label || `Fee ${index + 1}`;
    if (!old) return changes.push(`Added “${name}” ${money(fee.amount)} (${statusName(fee.status)})`);
    if (old.status !== fee.status) changes.push(`“${name}”: ${statusName(old.status)} → ${statusName(fee.status)}`);
    if ((Number(old.amount) || 0) !== fee.amount) changes.push(`“${name}”: amount ${money(Number(old.amount) || 0)} → ${money(fee.amount)}`);
    if ((Number(old.received) || 0) !== fee.received) changes.push(`“${name}”: received ${money(Number(old.received) || 0)} → ${money(fee.received)}`);
    if ((old.due || '') !== fee.due) changes.push(`“${name}”: follow-up date ${old.due || 'none'} → ${fee.due || 'none'}`);
  });
  before.slice(after.length).forEach((old, index) => changes.push(`Removed “${old.label || `Fee ${after.length + index + 1}`}”`));
  return changes;
};

export default function SuccessFees({ fees, onChange, boqTotal = 0, history = [] }: { fees: FeeRow[]; onChange: (fees: FeeRow[]) => void; boqTotal?: number; history?: any[] }) {
  const [percent, setPercent] = useState('');
  const setFee = (index: number, patch: Partial<FeeRow>) => onChange(fees.map((fee, i) => (i === index ? { ...fee, ...patch } : fee)));
  const totals = feeTotals(fees);
  const fromBoq = (Number(percent) / 100) * boqTotal;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">Success fee (MKA)</h3>
          <p className="text-xs text-muted-foreground">Fee for this project — add one line per instalment (stage). Nothing is payable until it is marked Earned.</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => onChange([...fees, blankFee()])}>
          <Plus className="mr-1 h-4 w-4" />
          Add fee
        </Button>
      </div>

      {boqTotal > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
          <span className="text-muted-foreground">Fee as % of BOQ total ({money(boqTotal)}):</span>
          <Input type="number" min="0" step="0.1" className="h-9 w-24 bg-white" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="e.g. 5" />
          {Number(percent) > 0 && <span className="font-semibold">= {money(fromBoq)}</span>}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!(Number(percent) > 0)}
            onClick={() => {
              onChange([...fees, { ...blankFee(), label: `${percent}% of BOQ`, amount: String(Math.round(fromBoq)), trigger: 'On order / payment release' }]);
              setPercent('');
            }}
          >
            Add as fee line
          </Button>
        </div>
      )}

      {!fees.length && <p className="rounded-xl bg-slate-50 py-5 text-center text-sm text-muted-foreground">No fee recorded yet. Click “Add fee”.</p>}
      <div className="space-y-3">
        {fees.map((fee, index) => (
          <div key={index} className="rounded-xl border bg-white p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_140px_200px_auto]">
              <Input value={fee.label} placeholder="Stage, e.g. On engagement / On order" onChange={(e) => setFee(index, { label: e.target.value })} />
              <Input type="number" min="0" value={fee.amount} placeholder="Amount" onChange={(e) => setFee(index, { amount: e.target.value })} />
              <Select value={fee.status} onValueChange={(value) => setFee(index, { status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FEE_STATUS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove fee ${index + 1}`} onClick={() => onChange(fees.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_160px_140px]">
              <Input className="h-9 text-xs" value={fee.trigger} placeholder="When is it payable? e.g. once TMVT receives the order" onChange={(e) => setFee(index, { trigger: e.target.value })} />
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Follow-up / due date</span>
                <Input type="date" className="h-9 text-xs" value={fee.due} onChange={(e) => setFee(index, { due: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Received so far</span>
                <Input type="number" min="0" className="h-9 text-xs" value={fee.received} onChange={(e) => setFee(index, { received: e.target.value })} />
              </label>
            </div>
          </div>
        ))}
      </div>

      {fees.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <p><span className="text-muted-foreground">Total fee: </span><span className="font-bold">{money(totals.potential)}</span></p>
          <p><span className="text-muted-foreground">Agreed: </span><span className="font-bold">{money(totals.agreed)}</span></p>
          <p><span className="text-muted-foreground">Received: </span><span className="font-bold text-emerald-700">{money(totals.received)}</span></p>
          <p><span className="text-muted-foreground">To collect: </span><span className="font-bold text-amber-700">{money(totals.outstanding)}</span></p>
          {totals.overdue > 0 && <p><span className="text-muted-foreground">Overdue: </span><span className="font-bold text-rose-700">{money(totals.overdue)}</span></p>}
        </div>
      )}
      {fees.some((fee) => fee.due && ['agreed', 'earned', 'invoiced', 'part_paid'].includes(fee.status)) && (
        <p className="mt-2 text-xs text-muted-foreground">A reminder is added to Tasks & reminders on the follow-up date for every unpaid agreed fee.</p>
      )}
      {history.length > 0 && (
        <details className="mt-3 rounded-xl bg-slate-50 p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Fee change history ({history.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {[...history].reverse().map((entry, index) => (
              <li key={index} className="text-muted-foreground">
                <span className="font-medium text-foreground">{new Date(entry.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                {entry.by ? ` · ${entry.by}` : ''} — {entry.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
