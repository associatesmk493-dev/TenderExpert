/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type ContactRow = { name: string; designation: string; phone: string; email: string; note: string };

export const blankContact = (): ContactRow => ({ name: '', designation: '', phone: '', email: '', note: '' });
export const toContactRows = (value: any): ContactRow[] =>
  Array.isArray(value) ? value.map((c: any) => ({ name: c.name || '', designation: c.designation || '', phone: c.phone || '', email: c.email || '', note: c.note || '' })) : [];
export const cleanContactRows = (rows: ContactRow[]) =>
  rows.filter((row) => Object.values(row).some((value) => value.trim())).map((row) => ({ name: row.name.trim(), designation: row.designation.trim(), phone: row.phone.trim(), email: row.email.trim(), note: row.note.trim() }));

// Extra people in the same company (besides the main contact): name, designation, phone and email.
export default function ContactsEditor({ rows, onChange }: { rows: ContactRow[]; onChange: (rows: ContactRow[]) => void }) {
  const set = (index: number, patch: Partial<ContactRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Other contacts in this company</h3>
          <p className="text-xs text-muted-foreground">Add everyone you deal with — name, designation, phone and email</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => onChange([...rows, blankContact()])}>
          <Plus className="mr-1 h-4 w-4" />
          Add contact
        </Button>
      </div>
      {rows.map((row, index) => (
        <div key={index} className="rounded-xl border bg-slate-50/60 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={row.name} placeholder="Contact person" onChange={(e) => set(index, { name: e.target.value })} />
            <Input value={row.designation} placeholder="Designation" onChange={(e) => set(index, { designation: e.target.value })} />
            <Input type="tel" value={row.phone} placeholder="Phone" onChange={(e) => set(index, { phone: e.target.value })} />
            <div className="flex gap-2">
              <Input type="email" className="min-w-0 flex-1" value={row.email} placeholder="Email" onChange={(e) => set(index, { email: e.target.value })} />
              <Button type="button" size="icon" variant="ghost" className="shrink-0" aria-label={`Remove contact ${index + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
