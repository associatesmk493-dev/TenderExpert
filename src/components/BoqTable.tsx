/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export type BoqRow = {
  item: string;
  make: string;
  qty: string;
  unit: string;
  rate: string;
  commercial_model: string;
  expected_profit: string;
};

const UNITS = ['No', 'Nos', 'Lot', 'Set', 'Unit', 'Cum', 'm3', 'Meter', 'Ltr', 'Month', 'Kg'];

export const blankBoqRow = (): BoqRow => ({ item: '', make: '', qty: '', unit: '', rate: '', commercial_model: '', expected_profit: '' });

// Line amount = quantity × rate (a missing quantity counts as 1).
export const lineAmount = (qty: string | number, rate: string | number) => (Number(qty) > 0 ? Number(qty) : 1) * (Number(rate) || 0);
export const boqTotalOf = (rows: BoqRow[]) => rows.reduce((sum, row) => sum + lineAmount(row.qty, row.rate), 0);

export const toBoqRows = (items: any): BoqRow[] => {
  const rows = Array.isArray(items) ? items : [];
  return rows.length
    ? rows.map((row: any) => {
        const qty = Number(row.qty) || 0;
        // Older rows only had a line amount; turn it into a per-unit rate.
        const rate = Number(row.rate) || (Number(row.amount) ? Number(row.amount) / (qty > 0 ? qty : 1) : 0);
        return {
          item: row.item || '',
          make: row.make || row.brand || '',
          qty: qty ? String(qty) : '',
          unit: row.unit || '',
          rate: rate ? String(rate) : '',
          commercial_model: row.commercial_model || '',
          expected_profit: row.expected_profit ? String(row.expected_profit) : '',
        };
      })
    : [blankBoqRow()];
};

// Rows ready to store: blank rows dropped, numbers converted.
export const cleanBoqRows = (rows: BoqRow[]) =>
  rows
    .filter((row) => Object.values(row).some((value) => value.trim()))
    .map((row) => ({
      item: row.item.trim(),
      make: row.make.trim(),
      qty: Number(row.qty) || 0,
      unit: row.unit.trim(),
      rate: Number(row.rate) || 0,
      amount: lineAmount(row.qty, row.rate),
      commercial_model: row.commercial_model.trim(),
      expected_profit: Number(row.expected_profit) || 0,
    }));

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function BoqTable({ rows, onChange }: { rows: BoqRow[]; onChange: (rows: BoqRow[]) => void }) {
  const setRow = (index: number, patch: Partial<BoqRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index: number) => onChange(rows.length === 1 ? [blankBoqRow()] : rows.filter((_, i) => i !== index));
  const totalAmount = boqTotalOf(rows);
  const totalProfit = rows.reduce((sum, row) => sum + (Number(row.expected_profit) || 0), 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">BOQ</h3>
          <p className="text-xs text-muted-foreground">Item, brand, quantity, unit and rate per unit — the amount is worked out for you</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" aria-label="Add BOQ row" onClick={() => onChange([...rows, blankBoqRow()])}>
          <Plus className="mr-1 h-4 w-4" />
          Add row
        </Button>
      </div>

      <datalist id="boq-units">{UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-12 px-2 py-2">S.No</th>
              <th className="min-w-[220px] px-2 py-2">Item</th>
              <th className="min-w-[200px] px-2 py-2">Brand / Make</th>
              <th className="w-20 px-2 py-2">Qty</th>
              <th className="w-24 px-2 py-2">Unit</th>
              <th className="w-32 px-2 py-2">Rate (per unit)</th>
              <th className="w-32 px-2 py-2">Amount</th>
              <th className="min-w-[140px] px-2 py-2">Commercial model</th>
              <th className="w-32 px-2 py-2">Expected profit</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t align-top">
                <td className="px-2 py-3 text-muted-foreground">{index + 1}</td>
                <td className="px-1 py-1"><Textarea rows={2} className="min-h-0" value={row.item} onChange={(e) => setRow(index, { item: e.target.value })} /></td>
                <td className="px-1 py-1"><Textarea rows={2} className="min-h-0" value={row.make} onChange={(e) => setRow(index, { make: e.target.value })} placeholder="Brand A / Brand B / Brand C" /></td>
                <td className="px-1 py-1"><Input type="number" min="0" value={row.qty} onChange={(e) => setRow(index, { qty: e.target.value })} /></td>
                <td className="px-1 py-1"><Input list="boq-units" value={row.unit} onChange={(e) => setRow(index, { unit: e.target.value })} /></td>
                <td className="px-1 py-1"><Input type="number" min="0" value={row.rate} onChange={(e) => setRow(index, { rate: e.target.value })} /></td>
                <td className="px-2 py-3 font-semibold">{money(lineAmount(row.qty, row.rate))}</td>
                <td className="px-1 py-1"><Input value={row.commercial_model} onChange={(e) => setRow(index, { commercial_model: e.target.value })} /></td>
                <td className="px-1 py-1"><Input type="number" value={row.expected_profit} onChange={(e) => setRow(index, { expected_profit: e.target.value })} /></td>
                <td className="px-1 py-1">
                  <Button type="button" size="icon" variant="ghost" title="Remove row" aria-label={`Remove row ${index + 1}`} onClick={() => removeRow(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground sm:hidden">Swipe the table sideways to see every column.</p>
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
        <p><span className="text-muted-foreground">BOQ total: </span><span className="font-bold">{money(totalAmount)}</span></p>
        <p><span className="text-muted-foreground">Total expected profit: </span><span className="font-bold">{money(totalProfit)}</span></p>
      </div>
    </div>
  );
}
