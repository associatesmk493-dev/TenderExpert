/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type BoqRow = {
  item: string;
  make: string;
  qty: string;
  unit: string;
  rate: string;
  amount: string;
  commercial_model: string;
  expected_profit: string;
};

export const blankBoqRow = (): BoqRow => ({ item: '', make: '', qty: '', unit: '', rate: '', amount: '', commercial_model: '', expected_profit: '' });

export const toBoqRows = (items: any): BoqRow[] => {
  const rows = Array.isArray(items) ? items : [];
  return rows.length
    ? rows.map((row: any) => ({
        item: row.item || '',
        make: row.make || row.brand || '',
        qty: row.qty ? String(row.qty) : '',
        unit: row.unit || '',
        rate: row.rate ? String(row.rate) : '',
        amount: row.amount ? String(row.amount) : Number(row.qty) && Number(row.rate) ? String(Number(row.qty) * Number(row.rate)) : '',
        commercial_model: row.commercial_model || '',
        expected_profit: row.expected_profit ? String(row.expected_profit) : '',
      }))
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
      amount: Number(row.amount) || (Number(row.qty) || 0) * (Number(row.rate) || 0),
      commercial_model: row.commercial_model.trim(),
      expected_profit: Number(row.expected_profit) || 0,
    }));

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function BoqTable({ rows, onChange }: { rows: BoqRow[]; onChange: (rows: BoqRow[]) => void }) {
  const setRow = (index: number, patch: Partial<BoqRow>) =>
    onChange(
      rows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // Amount follows qty × rate until it is typed by hand.
        if (('qty' in patch || 'rate' in patch) && Number(next.qty) > 0 && Number(next.rate) > 0) next.amount = String(Number(next.qty) * Number(next.rate));
        return next;
      }),
    );
  const removeRow = (index: number) => onChange(rows.length === 1 ? [blankBoqRow()] : rows.filter((_, i) => i !== index));
  const totalAmount = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const totalProfit = rows.reduce((sum, row) => sum + (Number(row.expected_profit) || 0), 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">BOQ</h3>
          <p className="text-xs text-muted-foreground">Item, brand, quantity, unit, rate, amount, commercial model and expected profit</p>
        </div>
        <Button type="button" size="icon" variant="outline" title="Add row" aria-label="Add BOQ row" onClick={() => onChange([...rows, blankBoqRow()])}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-12 px-2 py-2">S.No</th>
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2">Brand / Make</th>
              <th className="w-20 px-2 py-2">Qty</th>
              <th className="w-20 px-2 py-2">Unit</th>
              <th className="w-28 px-2 py-2">Rate</th>
              <th className="w-32 px-2 py-2">Amount</th>
              <th className="px-2 py-2">Commercial model</th>
              <th className="w-32 px-2 py-2">Expected profit</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t">
                <td className="px-2 py-1.5 text-muted-foreground">{index + 1}</td>
                <td className="px-1 py-1"><Input value={row.item} onChange={(e) => setRow(index, { item: e.target.value })} /></td>
                <td className="px-1 py-1"><Input value={row.make} onChange={(e) => setRow(index, { make: e.target.value })} placeholder="Brand A / Brand B" /></td>
                <td className="px-1 py-1"><Input type="number" min="0" value={row.qty} onChange={(e) => setRow(index, { qty: e.target.value })} /></td>
                <td className="px-1 py-1"><Input value={row.unit} onChange={(e) => setRow(index, { unit: e.target.value })} placeholder="no / lot" /></td>
                <td className="px-1 py-1"><Input type="number" min="0" value={row.rate} onChange={(e) => setRow(index, { rate: e.target.value })} /></td>
                <td className="px-1 py-1"><Input type="number" min="0" value={row.amount} onChange={(e) => setRow(index, { amount: e.target.value })} /></td>
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
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
        <p><span className="text-muted-foreground">BOQ total: </span><span className="font-bold">{money(totalAmount)}</span></p>
        <p><span className="text-muted-foreground">Total expected profit: </span><span className="font-bold">{money(totalProfit)}</span></p>
      </div>
    </div>
  );
}
